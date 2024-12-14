from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://michaelhanson2030:325220@fantasy-football.3fwji.mongodb.net/")

client = AsyncIOMotorClient(MONGODB_URL, server_api=ServerApi('1'))
db = client.get_database("src")

async def close_mongo_connection():
    client.close()

def get_database() -> AsyncIOMotorClient:
    return db

async def ping_database():
    try:
        await client.admin.command('ping')
        print("Successfully connected to MongoDB!")
    except Exception as e:
        print(f"Unable to connect to the MongoDB server: {e}")