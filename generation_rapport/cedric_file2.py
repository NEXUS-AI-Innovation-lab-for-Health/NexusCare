"""
GEMINI API MODULE - Cedric's Meeting Report Generator
Uses Google Gemini AI to structure raw meeting transcriptions into organized JSON format

Features:
- Takes raw transcription text from Whisper
- Structures text into organized paragraphs/sections using Gemini AI
- Returns structured JSON output suitable for report generation

Requirements:
    pip install google-generativeai
    
    Get API key from: https://makersuite.google.com/app/apikey
"""

import google.generativeai as genai
import json
from datetime import datetime
import os


class MeetingTextStructurer:
    """
    Structure raw meeting transcriptions into organized JSON using Gemini AI
    """
    
    def __init__(self, api_key=None):
        """
        Initialize Gemini API client
        
        Args:
            api_key: Google Gemini API key (or set GEMINI_API_KEY environment variable)
        """
        # Get API key from parameter or environment
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        
        if not self.api_key:
            raise ValueError(
                "Gemini API key required. Either:\n"
                "  1) Pass api_key parameter, or\n"
                "  2) Set GEMINI_API_KEY environment variable\n"
                "Get your key from: https://makersuite.google.com/app/apikey"
            )
        
        # Configure Gemini API
        genai.configure(api_key=self.api_key)
        
        # Initialize the model
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        
        print("✓ Gemini API initialized successfully")
    
    def structure_meeting_text(self, raw_transcription, meeting_type="general"):
        """
        Structure raw meeting transcription into organized JSON format
        
        Args:
            raw_transcription: Raw text from speech-to-text transcription
            meeting_type: Type of meeting ("general", "medical", "business", "technical")
        
        Returns:
            dict: Structured meeting data in JSON format
        """
        # Build the prompt for Gemini
        prompt = self._build_structuring_prompt(raw_transcription, meeting_type)
        
        try:
            print("🤖 Structuring text with Gemini AI...")
            
            # Generate structured content
            response = self.model.generate_content(prompt)
            
            # Parse the JSON response
            structured_data = self._parse_gemini_response(response.text)
            
            print("✓ Text successfully structured")
            return {
                'success': True,
                'structured_data': structured_data,
                'raw_response': response.text
            }
        
        except Exception as e:
            print(f"✗ Error structuring text: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _build_structuring_prompt(self, transcription, meeting_type):
        """
        Build the prompt for Gemini to structure the meeting text
        
        Args:
            transcription: Raw meeting transcription
            meeting_type: Type of meeting
        
        Returns:
            str: Complete prompt for Gemini
        """
        prompt = f"""
Tu es un assistant IA spécialisé dans la structuration de comptes-rendus de réunions médicales.
À partir de la transcription brute ci-dessous, organise le contenu dans un format JSON structuré.

Type de réunion : {meeting_type}

Instructions :
1. Extrais les informations clés de la transcription
2. Organise le contenu en sections et paragraphes logiques
3. Identifie les participants mentionnés
4. Extrais les actions à mener et les décisions prises
5. Rédige un résumé concis
6. Retourne UNIQUEMENT un JSON valide (aucun texte supplémentaire)

Structure JSON attendue :
{{
    "meeting_metadata": {{
        "date": "La date du jour au format JJ/MM/AAAA (ex: {datetime.now().strftime('%d/%m/%Y')})",
        "type": "{meeting_type}",
        "duration_estimate": "durée estimée en minutes"
    }},
    "participants": [
        "Nom/rôle du participant 1",
        "Nom/rôle du participant 2"
    ],
    "summary": "Résumé bref de 2-3 phrases de la réunion",
    "sections": [
        {{
            "title": "Nom de la section (ex: Ouverture, Discussion principale, etc.)",
            "content": "Contenu du paragraphe pour cette section",
            "timestamp": "horodatage approximatif si déductible"
        }}
    ],
    "key_points": [
        "Point clé 1",
        "Point clé 2",
        "Point clé 3"
    ],
    "action_items": [
        {{
            "task": "Description de l'action à mener",
            "responsible": "Personne responsable (si mentionnée)",
            "deadline": "Échéance (si mentionnée)"
        }}
    ],
    "decisions": [
        "Décision 1 prise lors de la réunion",
        "Décision 2 prise lors de la réunion"
    ]
}}

Transcription brute :
{transcription}

Retourne UNIQUEMENT la structure JSON ci-dessus, sans aucune explication ni texte supplémentaire. Rédige tout le contenu en français.
"""
        return prompt
    
    def _parse_gemini_response(self, response_text):
        """
        Parse Gemini's response into JSON
        
        Args:
            response_text: Raw response from Gemini
        
        Returns:
            dict: Parsed JSON data
        """
        try:
            # Try to extract JSON from the response
            # Gemini might wrap JSON in markdown code blocks
            if "```json" in response_text:
                # Extract JSON from markdown code block
                json_start = response_text.find("```json") + 7
                json_end = response_text.rfind("```")
                json_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                # Extract from generic code block
                json_start = response_text.find("```") + 3
                json_end = response_text.rfind("```")
                json_text = response_text[json_start:json_end].strip()
            else:
                json_text = response_text.strip()
            
            # Parse JSON
            structured_data = json.loads(json_text)
            return structured_data
        
        except json.JSONDecodeError as e:
            print(f"⚠ Warning: Could not parse JSON response: {e}")
            # Return a basic structure with the raw text
            return {
                "error": "Failed to parse JSON",
                "raw_text": response_text,
                "sections": [
                    {
                        "title": "Meeting Content",
                        "content": response_text
                    }
                ]
            }
    
    def generate_custom_structured_output(self, raw_text, custom_prompt):
        """
        Generate custom structured output using a user-defined prompt
        
        Args:
            raw_text: Input text to structure
            custom_prompt: Custom prompt for Gemini
        
        Returns:
            str: Gemini's response
        """
        try:
            print("🤖 Generating custom structured output...")
            response = self.model.generate_content(custom_prompt)
            
            print("✓ Custom output generated")
            return {
                'success': True,
                'response': response.text
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


# ===========================
# USAGE EXAMPLE
# ===========================

if __name__ == "__main__":
    # Set your Gemini API key
    # Option 1: Set environment variable
    # os.environ['GEMINI_API_KEY'] = 'your-api-key-here'
    
    # Option 2: Pass directly
    API_KEY = "your-api-key-here"  # Replace with your actual API key
    
    # Initialize the structurer
    try:
        structurer = MeetingTextStructurer(api_key=API_KEY)
    except ValueError as e:
        print(f"✗ Error: {e}")
        exit(1)
    
    # Example raw transcription from Whisper
    raw_transcription = """
    Good morning everyone. Welcome to today's medical team meeting. 
    Dr. Smith here with Dr. Johnson and Nurse Martinez. 
    We're here to discuss the patient care improvements for the cardiology department.
    
    Dr. Johnson, can you start with the recent updates on protocol changes?
    
    Yes, thank you. We've reviewed the new cardiac care protocols. 
    The main changes include enhanced monitoring for post-op patients and 
    updated medication dosing guidelines. We need to implement these by next month.
    
    Excellent. Nurse Martinez, what are your thoughts on staffing for this?
    
    We'll need additional training for the nursing staff. I suggest we schedule 
    two training sessions next week. Dr. Smith, can you lead the first session?
    
    Absolutely, I'll prepare the materials this week. 
    
    Great. So to summarize: Dr. Smith will prepare training materials, 
    Nurse Martinez will organize the sessions, and implementation target is next month.
    Any questions? No? Meeting adjourned.
    """
    
    # Structure the transcription
    result = structurer.structure_meeting_text(
        raw_transcription=raw_transcription,
        meeting_type="medical"
    )
    
    if result['success']:
        print("\n" + "="*60)
        print("STRUCTURED MEETING DATA:")
        print("="*60)
        print(json.dumps(result['structured_data'], indent=2))
        
        # Save to file
        output_file = f"structured_meeting_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result['structured_data'], f, indent=2, ensure_ascii=False)
        
        print(f"\n✓ Structured data saved to: {output_file}")
    else:
        print(f"\n✗ Error: {result['error']}")
