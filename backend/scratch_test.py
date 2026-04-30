import os
import sys
from unittest.mock import patch
from dotenv import load_dotenv
from flask import Flask

sys.path.insert(0, os.path.abspath('d:/flask-react/pdf-stream/backend'))
os.chdir('d:/flask-react/pdf-stream/backend')

from main import app

with app.app_context():
    try:
        from routes.pdf import _sync_documents_from_s3
        # We need to mock _workspace_owner to return something
        with patch('routes.pdf._workspace_owner', return_value='test@example.com'):
            _sync_documents_from_s3()
            print("S3 Sync SUCCESS")
    except Exception as e:
        import traceback
        traceback.print_exc()
