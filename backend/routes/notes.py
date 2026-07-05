from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.note import Note, NoteChunk
from extensions import db
from services.ai_service import generate_summary
from services.rag_service import chunk_text
import io

notes_bp = Blueprint("notes", __name__)

# Try to import PDF reading libraries for text extraction
PDF_LIBRARIES_INSTALLED = True
try:
    import pypdf
    def extract_pdf_text(file_stream):
        try:
            reader = pypdf.PdfReader(file_stream)
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            return text.strip(), None
        except Exception as e:
            print(f"Error reading PDF with pypdf: {e}")
            return None, str(e)
except ImportError:
    try:
        import PyPDF2
        def extract_pdf_text(file_stream):
            try:
                reader = PyPDF2.PdfReader(file_stream)
                text = ""
                for page in reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
                return text.strip(), None
            except Exception as e:
                print(f"Error reading PDF with PyPDF2: {e}")
                return None, str(e)
    except ImportError:
        PDF_LIBRARIES_INSTALLED = False
        def extract_pdf_text(file_stream):
            return None, "PDF parsing libraries are not installed"

@notes_bp.route("", methods=["POST"])
@jwt_required()
def create_note():
    user_id = get_jwt_identity()
    
    # Check if a PDF file is uploaded
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({"message": "Empty file uploaded"}), 400
            
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({"message": "Only PDF files are supported"}), 400
            
        if not PDF_LIBRARIES_INSTALLED:
            return jsonify({
                "message": "PDF parsing libraries are not installed on the server. Please run 'pip install pypdf' or copy-paste text directly."
            }), 400

        # Read the file stream
        file_stream = io.BytesIO(file.read())
        extracted_content, error_msg = extract_pdf_text(file_stream)
        
        if error_msg:
            return jsonify({
                "message": f"Failed to parse PDF file structure: {error_msg}. Please make sure the file is not corrupt."
            }), 400
            
        if not extracted_content:
            return jsonify({
                "message": "The uploaded PDF contains no extractable text. It might be a scanned document or an image. Please copy-paste the text content directly instead."
            }), 400
            
        title = request.form.get("title", file.filename.rsplit('.', 1)[0])
        content = extracted_content
    else:
        # Expect JSON text upload
        data = request.get_json()
        if not data or not data.get("title") or not data.get("content"):
            return jsonify({"message": "Missing note title or content"}), 400
        title = data["title"]
        content = data["content"]

    # Generate summary using the AI service
    summary = generate_summary(content)

    # Save main Note
    new_note = Note(
        user_id=user_id,
        title=title,
        content=content,
        summary=summary
    )
    db.session.add(new_note)
    db.session.commit() # Commit to get note.id

    # Chunk text and save NoteChunks for RAG
    chunks = chunk_text(content)
    for idx, chunk_text_content in enumerate(chunks):
        new_chunk = NoteChunk(
            note_id=new_note.id,
            content=chunk_text_content,
            chunk_index=idx
        )
        db.session.add(new_chunk)
        
    db.session.commit()

    return jsonify({
        "message": "Note uploaded and synthesized successfully",
        "note": {
            "id": new_note.id,
            "title": new_note.title,
            "summary": new_note.summary,
            "content": new_note.content,
            "created_at": new_note.created_at.isoformat()
        }
    }), 201

@notes_bp.route("", methods=["GET"])
@jwt_required()
def get_notes():
    user_id = get_jwt_identity()
    notes = Note.query.filter_by(user_id=user_id).order_by(Note.created_at.desc()).all()
    
    notes_list = []
    for note in notes:
        notes_list.append({
            "id": note.id,
            "title": note.title,
            "summary": note.summary,
            "content": note.content,
            "created_at": note.created_at.isoformat()
        })
        
    return jsonify(notes_list), 200

@notes_bp.route("/<int:note_id>", methods=["DELETE"])
@jwt_required()
def delete_note(note_id):
    user_id = get_jwt_identity()
    note = Note.query.filter_by(id=note_id, user_id=user_id).first()
    
    if not note:
        return jsonify({"message": "Note not found"}), 404
        
    db.session.delete(note)
    db.session.commit()
    
    return jsonify({"message": "Note deleted successfully"}), 200
