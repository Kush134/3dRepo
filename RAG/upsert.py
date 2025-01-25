from trulens.apps.custom import instrument
import json
from dotenv import load_dotenv
import os
import snowflake.connector

@instrument
def setup_databases(cur):
    """Set up required databases and tables."""
    # Create queries database if it doesn't exist
    cur.execute("CREATE DATABASE IF NOT EXISTS queries")
    
    # Create table for storing query-answer pairs
    cur.execute("""
        CREATE TABLE IF NOT EXISTS queries.public.query_answers (
            id INTEGER AUTOINCREMENT,
            question STRING,
            answer STRING,
            timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        )
    """)
    
    # Create VecTable in TestingData database
    cur.execute("""
        CREATE OR REPLACE TABLE TestingData.Rag_operations.VecTable (
            author STRING,
            code STRING,
            explanation STRING,
            files_edited INTEGER,
            sha STRING,
            combined STRING,
            vector VECTOR(FLOAT, 768),
            code_cleanliness_rating FLOAT
        )
    """)

@instrument
def analyze_code_cleanliness(code_snippet, cur):
    """Analyze code cleanliness using Mistral."""
    prompt = (
        "Please rate the cleanliness of the following code on a scale from 1 to 10, "
        "where 1 is very messy and 10 is very clean. Provide only the numerical rating."
        "The output should only be 1 number from 1 to 10 nothing else, no explanation.\n\n"
        f"Code:\n{code_snippet}\n\n"
        "Rating (1-10):"
    )
    cur.execute("""
        SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large', %s)
    """, (prompt,))
    response = cur.fetchone()[0]

    try:
        rating = float(response.strip())
    except ValueError:
        rating = 5.0
    return rating

@instrument
def run_upsert(json_file, connection_params):
    """Run upsert operation with the given JSON file."""
    conn = snowflake.connector.connect(**connection_params)
    cur = None
    try:
        cur = conn.cursor()
        
        # Set up databases and tables
        setup_databases(cur)

        # Load and process JSON data
        with open(json_file, 'r') as file:
            json_array = json.load(file)

        for index, json_obj in enumerate(json_array):
            author = json_obj.get('author', '')
            code = json_obj.get('code', '')
            explanation = json_obj.get('explanation', '')
            sha = json_obj.get('sha', '')
            files_edited = json_obj.get('files edited', 0)
            
            combined_text = (
                f"The author is: {author}\n"
                f"Here is the code: {code}\n"
                f"Explanation:\n{explanation}\n"
                f"SHA: {sha}\n"
                f"Files edited: {files_edited}"
            )
            
            # Generate embedding
            cur.execute("""
                SELECT SNOWFLAKE.CORTEX.EMBED_TEXT_768('e5-base-v2', %s)
            """, (combined_text,))
            embedding_list = cur.fetchone()[0]
            
            embedding_str = ",".join(str(x) for x in embedding_list)
            embedding_literal = f"[{embedding_str}]::VECTOR(FLOAT, 768)"

            cleanliness_rating = analyze_code_cleanliness(code, cur)

            insert_sql = """
                INSERT INTO TestingData.Rag_operations.VecTable (
                    author,
                    code,
                    explanation,
                    files_edited,
                    sha,
                    combined,
                    vector,
                    code_cleanliness_rating
                )
                SELECT
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    {0},
                    %s
                FROM (SELECT 1)
            """.format(embedding_literal)
            
            cur.execute(insert_sql, (
                author,
                code,
                explanation,
                files_edited,
                sha,
                combined_text,
                cleanliness_rating
            ))

        return True

    finally:
        if cur:
            cur.close()
        conn.close()