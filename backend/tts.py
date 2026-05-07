"""
tts.py — TTS stub for online/cloud hosting
-------------------------------------------
Piper TTS only runs on the local Windows kiosk machine.
In production (Railway), TTS is handled by the browser's
built-in window.speechSynthesis API on the frontend — no server needed.
"""
from flask import Blueprint, jsonify

tts_bp = Blueprint("tts", __name__)

@tts_bp.route("/tts", methods=["POST"])
def speak():
    return jsonify({"error": "Piper TTS not available in online mode. Browser TTS is used instead."}), 503

@tts_bp.route("/tts/voices", methods=["GET"])
def list_voices():
    return jsonify({"default_voice": None, "voices": [], "note": "Piper TTS not available in online mode."})
