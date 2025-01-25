from trulens.apps.custom import instrument
import os
from dotenv import load_dotenv
import snowflake.connector
import logging

logger = logging.getLogger(__name__)

@instrument
def store_query_answer(question, answer, conn):
    """Store the question-answer pair in the queries database."""
    logger.info("Storing query-answer pair")
    cur = conn.cursor()
    try:
        insert_sql = """
            INSERT INTO queries.public.query_answers (question, answer)
            VALUES (%s, %s)
        """
        cur.execute(insert_sql, (question, answer))
        logger.info("Successfully stored query-answer pair")
    except Exception as e:
        logger.error(f"Error storing query-answer pair: {str(e)}")
        raise
    finally:
        cur.close()

@instrument
def run_query(user_query, connection_params):
    """Run a query against Snowflake and return results."""
    logger.info(f"Running query: {user_query}")
    conn = snowflake.connector.connect(**connection_params)
    cur = None
    try:
        cur = conn.cursor()

        # Generate embedding
        logger.info("Generating embedding for user query")
        try:
            cur.execute("""
                SELECT SNOWFLAKE.CORTEX.EMBED_TEXT_768('e5-base-v2', %s)
            """, (user_query,))
            user_embedding = cur.fetchone()[0]
        except Exception as e:
            logger.error(f"Failed to generate embedding: {str(e)}")
            raise Exception(f"Failed to generate embedding: {str(e)}")

        # Convert embedding to Snowflake vector literal
        embedding_str = ",".join(str(x) for x in user_embedding)
        embedding_literal = f"[{embedding_str}]::VECTOR(FLOAT, 768)"

        # Similarity search
        logger.info("Performing similarity search")
        similarity_sql = f"""
        SELECT
            sha,
            combined,
            VECTOR_COSINE_SIMILARITY(vector, {embedding_literal}) AS similarity
        FROM TestingData.Rag_operations.VecTable
        ORDER BY similarity DESC
        LIMIT 5
        """
        cur.execute(similarity_sql)
        top_results = cur.fetchall()
        logger.info(f"Found {len(top_results)} similar results")

        contexts = [row[1] for row in top_results]
        combined_context = "\n\n".join(contexts)

        # Get AI response
        logger.info("Generating AI response")
        prompt = (
            f"Given this information about some code commits:\n\n{combined_context}\n\n"
            f"User question: {user_query}\n\nPlease provide a relevant answer:"
        )

        cur.execute("""
            SELECT SNOWFLAKE.CORTEX.COMPLETE(
                'mistral-large',
                %s
            )
        """, (prompt,))
        response = cur.fetchone()[0]
        logger.info("Successfully generated AI response")

        # Store the query-answer pair
        store_query_answer(user_query, response, conn)

        return response

    except Exception as e:
        logger.error(f"Error in run_query: {str(e)}")
        raise
    finally:
        if cur:
            cur.close()
        conn.close()