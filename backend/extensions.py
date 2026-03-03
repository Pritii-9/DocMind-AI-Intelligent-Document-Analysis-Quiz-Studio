import boto3
from flask import current_app
from flask_jwt_extended import JWTManager
from flask_mail import Mail

mail = Mail()
jwt = JWTManager()


def get_s3_client():
    if "s3_client" not in current_app.extensions:
        current_app.extensions["s3_client"] = boto3.client(
            "s3",
            aws_access_key_id=current_app.config.get("AWS_ACCESS_KEY"),
            aws_secret_access_key=current_app.config.get("AWS_SECRET_KEY"),
            region_name=current_app.config.get("AWS_REGION"),
        )
    return current_app.extensions["s3_client"]
