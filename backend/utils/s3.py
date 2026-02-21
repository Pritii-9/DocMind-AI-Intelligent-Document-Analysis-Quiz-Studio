import os

def get_pdf_stream(key, range_header=None):
    # This path points to your local 'storage' folder
    file_path = os.path.join("storage", key)
    
    if not os.path.exists(file_path):
        # This will show the error in your terminal
        print(f"❌ Error: {file_path} not found!")
        raise FileNotFoundError(f"File {key} not found in storage folder")

    # Open the file in binary mode for streaming
    return {
        "Body": open(file_path, "rb")
    }