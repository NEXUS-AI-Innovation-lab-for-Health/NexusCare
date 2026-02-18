"""
COMPLETE MEETING REPORT GENERATOR - Integration Guide for Cedric
Combines Speech-to-Text, Gemini AI, and PDF Generation

This file demonstrates how to use all three modules together:
1. cedric_file1.py - Whisper Speech-to-Text
2. cedric_file2.py - Gemini API Text Structuring
3. cedric_file3.py - ReportLab PDF Generation

Complete Pipeline:
    Audio Recording → Whisper → Raw Text → Gemini → Structured JSON → PDF Report
"""

import os
from datetime import datetime

# Import the three modules
from cedric_file1 import MeetingTranscriber
from cedric_file2 import MeetingTextStructurer
from cedric_file3 import MeetingReportPDF


class CompleteMeetingReportGenerator:
    """
    Complete pipeline for generating meeting reports from audio recordings
    """
    
    def __init__(self, gemini_api_key, organization_name="Medical Center", whisper_model="base"):
        """
        Initialize the complete pipeline
        
        Args:
            gemini_api_key: Google Gemini API key
            organization_name: Organization name for PDF header
            whisper_model: Whisper model size (default: 'base')
        """
        # Initialize all three components
        self.transcriber = MeetingTranscriber(model_size=whisper_model)
        self.structurer = MeetingTextStructurer(api_key=gemini_api_key)
        self.pdf_generator = MeetingReportPDF(organization_name=organization_name)
        
        print("="*60)
        print("Complete Meeting Report Generator - Ready")
        print("="*60)
    
    def generate_report_from_audio(
        self,
        audio_file_path,
        output_pdf_filename=None,
        meeting_type="general",
        whisper_model="base",
        language="fr"
    ):
        """
        Complete pipeline: Audio → PDF Report
        
        Args:
            audio_file_path: Path to audio recording file
            output_pdf_filename: Output PDF filename (auto-generated if None)
            meeting_type: Type of meeting ("general", "medical", "business", "technical")
            whisper_model: Whisper model size ('tiny', 'base', 'small', 'medium', 'large')
        
        Returns:
            dict: {
                'success': bool,
                'pdf_path': str,
                'transcription': str,
                'structured_data': dict
            }
        """
        print("\n" + "="*60)
        print("STEP 1/3: SPEECH-TO-TEXT TRANSCRIPTION")
        print("="*60)
        
        # Step 1: Transcribe audio to text using Whisper
        transcription_result = self.transcriber.transcribe_audio_file(audio_file_path, language=language)
        
        if not transcription_result['success']:
            return {
                'success': False,
                'error': f"Transcription failed: {transcription_result['error']}"
            }
        
        raw_transcription = transcription_result['transcription']
        print(f"✓ Transcription complete: {len(raw_transcription)} characters")
        
        # Step 2: Structure text with Gemini AI
        print("\n" + "="*60)
        print("STEP 2/3: TEXT STRUCTURING WITH GEMINI AI")
        print("="*60)
        
        structure_result = self.structurer.structure_meeting_text(
            raw_transcription=raw_transcription,
            meeting_type=meeting_type
        )
        
        if not structure_result['success']:
            return {
                'success': False,
                'error': f"Text structuring failed: {structure_result['error']}",
                'transcription': raw_transcription
            }
        
        structured_data = structure_result['structured_data']
        print("✓ Text structured successfully")
        
        # Step 3: Generate PDF report
        print("\n" + "="*60)
        print("STEP 3/3: PDF REPORT GENERATION")
        print("="*60)
        
        if output_pdf_filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_pdf_filename = f"meeting_report_{timestamp}.pdf"
        
        try:
            pdf_path = self.pdf_generator.generate_report(
                structured_data=structured_data,
                output_filename=output_pdf_filename,
                report_title=f"{meeting_type.title()} Meeting Report"
            )
            
            print("\n" + "="*60)
            print("✓ COMPLETE - REPORT GENERATED SUCCESSFULLY")
            print("="*60)
            
            return {
                'success': True,
                'pdf_path': pdf_path,
                'transcription': raw_transcription,
                'structured_data': structured_data
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': f"PDF generation failed: {str(e)}",
                'transcription': raw_transcription,
                'structured_data': structured_data
            }
    
    def generate_report_from_text(
        self,
        raw_text,
        output_pdf_filename=None,
        meeting_type="general"
    ):
        """
        Generate report from already transcribed text (skip Step 1)
        
        Args:
            raw_text: Raw meeting transcription text
            output_pdf_filename: Output PDF filename
            meeting_type: Type of meeting
        
        Returns:
            dict: Result dictionary
        """
        print("\n" + "="*60)
        print("STEP 1/2: TEXT STRUCTURING WITH GEMINI AI")
        print("="*60)
        
        # Structure text with Gemini
        structure_result = self.structurer.structure_meeting_text(
            raw_transcription=raw_text,
            meeting_type=meeting_type
        )
        
        if not structure_result['success']:
            return {
                'success': False,
                'error': f"Text structuring failed: {structure_result['error']}"
            }
        
        structured_data = structure_result['structured_data']
        
        # Generate PDF
        print("\n" + "="*60)
        print("STEP 2/2: PDF REPORT GENERATION")
        print("="*60)
        
        if output_pdf_filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_pdf_filename = f"meeting_report_{timestamp}.pdf"
        
        try:
            pdf_path = self.pdf_generator.generate_report(
                structured_data=structured_data,
                output_filename=output_pdf_filename
            )
            
            return {
                'success': True,
                'pdf_path': pdf_path,
                'structured_data': structured_data
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': f"PDF generation failed: {str(e)}"
            }


# ===========================
# USAGE EXAMPLES
# ===========================

if __name__ == "__main__":
    # Configure your Gemini API key
    GEMINI_API_KEY = "your-gemini-api-key-here"  # Replace with your actual key
    
    # Initialize the complete generator
    generator = CompleteMeetingReportGenerator(
        gemini_api_key=GEMINI_API_KEY,
        organization_name="Medical Professionals Association"
    )
    
    # ==========================================
    # EXAMPLE 1: Complete Pipeline from Audio
    # ==========================================
    print("\n\n*** EXAMPLE 1: Generate Report from Audio File ***")
    
    audio_file = "doctor_meeting_recording.wav"
    
    if os.path.exists(audio_file):
        result = generator.generate_report_from_audio(
            audio_file_path=audio_file,
            output_pdf_filename="doctor_meeting_report.pdf",
            meeting_type="medical",
            whisper_model="base"  # Options: tiny, base, small, medium, large
        )
        
        if result['success']:
            print(f"\n✓ SUCCESS! Report saved to: {result['pdf_path']}")
            print(f"\nTranscription preview:")
            print(result['transcription'][:200] + "...")
        else:
            print(f"\n✗ ERROR: {result['error']}")
    else:
        print(f"Audio file not found: {audio_file}")
    
    # ==========================================
    # EXAMPLE 2: Generate Report from Text
    # ==========================================
    print("\n\n*** EXAMPLE 2: Generate Report from Text (no audio) ***")
    
    sample_text = """
    Good afternoon colleagues. This is Dr. Anderson opening our weekly medical 
    staff meeting on January 15th, 2024. Present today are Dr. Chen from neurology, 
    Dr. Patel from cardiology, and Head Nurse Williams.
    
    First item on our agenda is the new patient intake protocol. Dr. Chen, 
    would you like to share your findings from the pilot program?
    
    Thank you Dr. Anderson. The new digital intake system has reduced patient 
    wait times by 35 percent. We processed 150 patients last week with minimal issues. 
    I recommend full implementation by February 1st.
    
    Excellent results. Dr. Patel, any concerns from the cardiology perspective?
    
    No concerns. The system integrates well with our existing cardiac monitoring 
    protocols. My team is ready for full implementation.
    
    Perfect. Nurse Williams, do we have adequate staff training?
    
    Yes doctor. All nursing staff completed the training modules. We scheduled 
    refresher sessions for next Monday.
    
    Outstanding. Let's move forward with full implementation on February 1st. 
    Dr. Chen will oversee the rollout, Nurse Williams will coordinate staff scheduling, 
    and Dr. Patel will monitor integration with cardiac systems.
    
    Any other business? No? Meeting adjourned. Thank you everyone.
    """
    
    result = generator.generate_report_from_text(
        raw_text=sample_text,
        output_pdf_filename="text_based_meeting_report.pdf",
        meeting_type="medical"
    )
    
    if result['success']:
        print(f"\n✓ SUCCESS! Report saved to: {result['pdf_path']}")
    else:
        print(f"\n✗ ERROR: {result['error']}")
    
    # ==========================================
    # EXAMPLE 3: Using Different Whisper Models
    # ==========================================
    """
    # For faster processing (use tiny model):
    from cedric_file1 import MeetingTranscriber
    
    fast_generator = CompleteMeetingReportGenerator(
        gemini_api_key=GEMINI_API_KEY,
        organization_name="Medical Center",
        whisper_model="tiny"  # Fast but less accurate
    )
    result = fast_generator.generate_report_from_audio("meeting.mp3", "report.pdf")
    
    # For better accuracy (use large model):
    accurate_generator = CompleteMeetingReportGenerator(
        gemini_api_key=GEMINI_API_KEY,
        whisper_model="large"  # Best accuracy, requires GPU
    )
    result = accurate_generator.generate_report_from_audio("meeting.mp3", "report.pdf")
    """
