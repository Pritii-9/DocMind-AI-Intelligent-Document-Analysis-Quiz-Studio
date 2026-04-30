from main import app
import traceback
with app.app_context():
    try:
        from services.ai_service import trigger_background_ingest
        print("trigger_background_ingest import OK")
        from langgraph.checkpoint.mongodb import MongoDBSaver
        print("MongoDBSaver import OK")
    except Exception as e:
        traceback.print_exc()
