# dashboard.py
from dotenv import load_dotenv
import os
from query import run_query
from upsert import run_upsert
from trulens.connectors.snowflake import SnowflakeConnector
from trulens.core import TruSession
from trulens.core import Feedback
from trulens.apps.custom import TruCustomApp, instrument
from trulens.providers.cortex import Cortex
import snowflake.connector
import logging

logger = logging.getLogger(__name__)

def validate_connection(connection_params):
    """Validate Snowflake connection parameters."""
    logger.info("Validating Snowflake connection")
    try:
        conn = snowflake.connector.connect(**connection_params)
        conn.cursor().execute("SELECT 1")
        logger.info("Successfully validated Snowflake connection")
        return True
    except Exception as e:
        logger.error(f"Connection validation failed: {str(e)}")
        return False

class CodeAnalyticsApp:
    @instrument
    def process_json(self, json_file, connection_params):
        logger.info(f"Processing JSON file: {json_file}")
        return run_upsert(json_file, connection_params)
    
    @instrument
    def process_query(self, query, connection_params):
        logger.info(f"Processing query: {query}")
        return run_query(query, connection_params)

def get_analytics(connection_params):
    """Get analytics from Snowflake database."""
    logger.info("Fetching analytics from Snowflake")
    conn = snowflake.connector.connect(**connection_params)
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT 
                COUNT(DISTINCT author) as num_authors,
                COUNT(*) as num_commits,
                AVG(code_cleanliness_rating) as mean_cleanliness
            FROM TestingData.Rag_operations.VecTable
        """)
        
        result = cur.fetchone()
        logger.info("Successfully fetched analytics")
        return result
    except Exception as e:
        logger.error(f"Error fetching analytics: {str(e)}")
        raise
    finally:
        cur.close()
        conn.close()

def main():
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger.info("Starting Code Analytics application")
    
    # Load environment variables
    load_dotenv()
    
    # Verify required environment variables
    required_env_vars = [
        'SNOWFLAKE_PASSWORD',
        'SNOWFLAKE_USER',
        'SNOWFLAKE_ACCOUNT',
        'SNOWFLAKE_WAREHOUSE',
        'SNOWFLAKE_DATABASE',
        'SNOWFLAKE_SCHEMA'
    ]
    
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        return
    
    try:
        # Set up connection parameters
        connection_params = {
            "account": os.getenv('SNOWFLAKE_ACCOUNT'),
            "user": os.getenv('SNOWFLAKE_USER'),
            "password": os.getenv('SNOWFLAKE_PASSWORD'),
            "database": os.getenv('SNOWFLAKE_DATABASE'),
            "schema": os.getenv('SNOWFLAKE_SCHEMA'),
            "warehouse": os.getenv('SNOWFLAKE_WAREHOUSE'),
            "role": "ACCOUNTADMIN"
        }
        
        # Validate connection
        if not validate_connection(connection_params):
            logger.error("Failed to validate Snowflake connection")
            return
        
        # Create app instance
        app = CodeAnalyticsApp()
        logger.info("Created CodeAnalyticsApp instance")
        
        # Get JSON file name from user
        json_file = input("Enter the name of your JSON file: ")
        
        # Verify file exists
        if not os.path.exists(json_file):
            logger.error(f"Error: File '{json_file}' not found!")
            return
        
        # Run upsert operation
        logger.info(f"Processing JSON file: {json_file}")
        app.process_json(json_file, connection_params)
        logger.info("Upsert completed successfully!")
        
        # Get and display analytics
        try:
            analytics = get_analytics(connection_params)
            if analytics:
                num_authors, num_commits, mean_cleanliness = analytics
                print("\nAnalytics:")
                print(f"Number of unique authors: {num_authors}")
                print(f"Total number of commits: {num_commits}")
                print(f"Mean code cleanliness rating: {mean_cleanliness:.2f}")
        except Exception as e:
            logger.error(f"Failed to get analytics: {str(e)}")
        
        # Query loop
        while True:
            user_query = input("\nEnter your query (or 'quit' to exit): ")
            if user_query.lower() == 'quit':
                break
                
            try:
                response = app.process_query(user_query, connection_params)
                print("\nAI Response:")
                print(response)
                print("\n" + "-"*50)
            except Exception as e:
                logger.error(f"Query processing failed: {str(e)}")
                print(f"Error processing query: {str(e)}")
        
    except Exception as e:
        logger.error(f"Application error: {str(e)}")
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()