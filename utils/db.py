from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://michaelhanson2030:325220@fantasy-football.3fwji.mongodb.net/")

# We'll make this a function to ensure fresh connections
async def get_database():
    """Get database connection with proper async client setup"""
    client = AsyncIOMotorClient(MONGODB_URL, server_api=ServerApi('1'))
    db = client.get_database("src")
    db.client = client  # Store client reference for cleanup
    
    # Test connection
    try:
        await client.admin.command('ping')
        print("Successfully connected to MongoDB!")
    except Exception as e:
        print(f"Unable to connect to the MongoDB server: {e}")
        client.close()
        raise
        
    return db

async def close_mongo_connection(db):
    """Properly close MongoDB connection"""
    if hasattr(db, 'client'):
        db.client.close()