import pytest
from services.ai_service import classify_document_text

def test_classify_document_text_invoice():
    sample_invoice = """
    INVOICE #INV-2026-001
    Bill To: Acro Corp
    Date: 2026-09-23
    Total Amount Due: $1,450.00
    Subtotal: $1,300.00
    Tax: $150.00
    Payment Terms: Net 30
    """
    res = classify_document_text(sample_invoice)
    assert res["category"] == "Financial Invoice"
    assert "Invoice" in res["tags"] or "Finance" in res["tags"]

def test_classify_document_text_contract():
    sample_contract = """
    NON-DISCLOSURE AGREEMENT
    This Agreement is entered into by and between Party A and Party B.
    Section 1: Confidential Information.
    Section 2: Governing Law. This contract shall be governed by the laws of California.
    """
    res = classify_document_text(sample_contract)
    assert res["category"] == "Legal Contract"
    assert "Legal" in res["tags"] or "Contract" in res["tags"]

def test_classify_document_text_tech_spec():
    sample_spec = """
    System Requirements & Architecture Specification
    REST API Endpoint Documentation v2.0
    Database schema definition and deployment guidelines for FastAPI service.
    """
    res = classify_document_text(sample_spec)
    assert res["category"] == "Technical Spec"
    assert "Technical" in res["tags"] or "Spec" in res["tags"]
