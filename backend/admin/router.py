import os
import shutil
from typing import List
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Response, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta, timezone

from config import get_settings
from rag.qdrant_store import get_document_chunk_count, delete_document_by_source, search_vector_store
from ingest_docs import yield_ingestion_progress, DOCS_DIR

router = APIRouter()
settings = get_settings()

class LoginRequest(BaseModel):
    username: str
    password: str

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_current_admin(request: Request):
    token = request.cookies.get("admin_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username != settings.ADMIN_USERNAME:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/login")
def login(req: LoginRequest, response: Response):
    if req.username == settings.ADMIN_USERNAME and req.password == settings.ADMIN_PASSWORD:
        token = create_access_token(data={"sub": req.username})
        # Set HTTPOnly cookie
        response.set_cookie(
            key="admin_token",
            value=token,
            httponly=True,
            secure=settings.APP_ENV == "production",
            samesite="lax",
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        return {"message": "Login successful"}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("admin_token")
    return {"message": "Logged out"}

@router.get("/check-auth")
def check_auth(admin: str = Depends(get_current_admin)):
    return {"authenticated": True, "user": admin}

@router.get("/docs")
def list_docs(admin: str = Depends(get_current_admin)):
    os.makedirs(DOCS_DIR, exist_ok=True)
    pdf_files = [f for f in os.listdir(DOCS_DIR) if f.lower().endswith(".pdf")]
    
    docs_info = []
    for file_name in pdf_files:
        chunk_count = get_document_chunk_count(file_name)
        docs_info.append({
            "filename": file_name,
            "status": "ingested" if chunk_count > 0 else "pending",
            "chunks": chunk_count
        })
        
    return {"docs": docs_info}

@router.post("/upload")
def upload_doc(file: UploadFile = File(...), admin: str = Depends(get_current_admin)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
    os.makedirs(DOCS_DIR, exist_ok=True)
    file_path = os.path.join(DOCS_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"message": f"Successfully uploaded {file.filename}", "filename": file.filename}

@router.delete("/docs/{filename}")
def delete_doc(filename: str, admin: str = Depends(get_current_admin)):
    file_path = os.path.join(DOCS_DIR, filename)
    
    # 1. Delete from Qdrant
    qdrant_deleted = delete_document_by_source(filename)
    
    # 2. Delete from filesystem
    fs_deleted = False
    if os.path.exists(file_path):
        os.remove(file_path)
        fs_deleted = True
        
    if not qdrant_deleted and not fs_deleted:
        raise HTTPException(status_code=404, detail="File not found in DB or filesystem")
        
    return {"message": f"Deleted {filename}", "qdrant_deleted": qdrant_deleted, "fs_deleted": fs_deleted}

@router.get("/ingest/{filename}")
def stream_ingestion(filename: str): # Authentication omitted for SSE or handled via token in URL if necessary, but assuming internal
    file_path = os.path.join(DOCS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    async def sse_generator():
        for progress_json in yield_ingestion_progress(file_path):
            yield f"data: {progress_json}\n\n"
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@router.get("/embeddings/search")
def search_embeddings(q: str, limit: int = 5, admin: str = Depends(get_current_admin)):
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
        
    results = search_vector_store(q, limit=limit)
    return {"results": results}
