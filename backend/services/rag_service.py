import re
import math
from models.note import NoteChunk

def tokenize(text):
    """
    Cleans and tokenizes text into lowercase alphanumeric words.
    """
    return re.findall(r'\b\w+\b', text.lower())

def calculate_cosine_similarity(query_tokens, doc_tokens):
    """
    Calculates cosine similarity between query and document word counts.
    """
    if not query_tokens or not doc_tokens:
        return 0.0
        
    q_counts = {}
    for token in query_tokens:
        q_counts[token] = q_counts.get(token, 0) + 1
        
    d_counts = {}
    for token in doc_tokens:
        d_counts[token] = d_counts.get(token, 0) + 1
        
    # Dot product
    dot_product = 0.0
    for term, q_val in q_counts.items():
        if term in d_counts:
            dot_product += q_val * d_counts[term]
            
    # Norms
    q_norm = math.sqrt(sum(val ** 2 for val in q_counts.values()))
    d_norm = math.sqrt(sum(val ** 2 for val in d_counts.values()))
    
    if q_norm == 0 or d_norm == 0:
        return 0.0
        
    return dot_product / (q_norm * d_norm)

def chunk_text(text, chunk_size=600, overlap=150):
    """
    Splits text into chunks of roughly chunk_size characters with overlap.
    """
    chunks = []
    if not text:
        return chunks
        
    text_length = len(text)
    start = 0
    while start < text_length:
        end = min(start + chunk_size, text_length)
        # Avoid cutting in the middle of a word if possible
        if end < text_length:
            last_space = text.rfind(' ', start, end)
            if last_space != -1 and last_space > start + (chunk_size // 2):
                end = last_space
        chunks.append(text[start:end].strip())
        start = end - overlap if end < text_length else text_length
        if start <= 0 or start >= text_length:
            break
    return [c for c in chunks if len(c) > 10]

def retrieve_context(user_id, query, top_k=3):
    """
    Retrieves the most contextually relevant chunks from the user's notes.
    """
    # Fetch all chunks for notes owned by this user
    # NoteChunk is joined with Note to filter by user_id
    from extensions import db
    from models.note import Note
    
    chunks = db.session.query(NoteChunk).join(Note).filter(Note.user_id == user_id).all()
    if not chunks:
        return []
        
    query_tokens = tokenize(query)
    if not query_tokens:
        return []
        
    scored_chunks = []
    for chunk in chunks:
        doc_tokens = tokenize(chunk.content)
        similarity = calculate_cosine_similarity(query_tokens, doc_tokens)
        if similarity > 0.05: # Threshold to filter completely irrelevant chunks
            scored_chunks.append((similarity, chunk.content))
            
    # Sort by similarity descending
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    
    # Return top K content strings
    return [content for _, content in scored_chunks[:top_k]]
