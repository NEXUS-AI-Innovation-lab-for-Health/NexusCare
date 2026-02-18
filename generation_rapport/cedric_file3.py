"""
PDF REPORT GENERATOR - Cedric's Meeting Report Generator
Uses ReportLab to generate professional PDF meeting reports

Features:
- Generates professional PDF reports from structured meeting data
- Includes meeting metadata, participants, summary, sections, and action items
- Customizable styling and formatting

Requirements:
    pip install reportlab
"""

import json
from datetime import datetime
from pathlib import Path
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.units import mm, cm, inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors


class MeetingReportPDF:
    """
    Generate professional PDF meeting reports using ReportLab
    """
    
    def __init__(self, organization_name="Organization Name"):
        """
        Initialize PDF report generator
        
        Args:
            organization_name: Name of the organization/hospital
        """
        self.organization_name = organization_name
        
        # Setup styles
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        
        print("✓ PDF Report Generator initialized")
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles for the report.

        If a style already exists in the sample stylesheet, update its attributes
        instead of attempting to re-add it (ReportLab raises when a duplicate
        name is added).
        """

        def add_or_update(name, **kwargs):
            if name in self.styles:
                s = self.styles[name]
                # update only provided attributes
                for k, v in kwargs.items():
                    try:
                        setattr(s, k, v)
                    except Exception:
                        # some attributes may be read-only on existing styles; ignore
                        pass
            else:
                self.styles.add(ParagraphStyle(name=name, **kwargs))

        # Title style
        add_or_update(
            'ReportTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1a5490'),
            fontName='Helvetica-Bold',
            alignment=TA_CENTER,
            spaceAfter=20
        )

        # Organization header
        add_or_update(
            'OrgHeader',
            parent=self.styles['Normal'],
            fontSize=14,
            textColor=colors.HexColor('#1a5490'),
            fontName='Helvetica-Bold',
            alignment=TA_CENTER,
            spaceAfter=10
        )

        # Section header (blue)
        add_or_update(
            'SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#1a5490'),
            fontName='Helvetica-Bold',
            spaceAfter=10,
            spaceBefore=15,
            borderWidth=0,
            borderColor=colors.HexColor('#1a5490'),
            borderPadding=5
        )

        # Subsection header
        add_or_update(
            'SubsectionHeader',
            parent=self.styles['Heading3'],
            fontSize=12,
            textColor=colors.HexColor('#2e5c8a'),
            fontName='Helvetica-Bold',
            spaceAfter=8,
            spaceBefore=10
        )

        # Body text (update existing 'BodyText' if present)
        add_or_update(
            'BodyText',
            parent=self.styles.get('Normal', None),
            fontSize=11,
            textColor=colors.black,
            alignment=TA_JUSTIFY,
            spaceAfter=10,
            leading=14
        )

        # Metadata style
        add_or_update(
            'MetadataText',
            parent=self.styles.get('Normal', None),
            fontSize=10,
            textColor=colors.HexColor('#666666'),
            spaceAfter=6
        )

        # Bullet list style
        add_or_update(
            'BulletText',
            parent=self.styles.get('Normal', None),
            fontSize=11,
            textColor=colors.black,
            leftIndent=20,
            spaceAfter=6,
            bulletIndent=10
        )
    
    def generate_report(self, structured_data, output_filename="meeting_report.pdf", report_title=None):
        """
        Generate PDF report from structured meeting data
        
        Args:
            structured_data: Structured meeting data (from Gemini API)
            output_filename: Output PDF filename
            report_title: Custom report title (default: "Meeting Report")
        
        Returns:
            str: Path to generated PDF file
        """
        # Set default title
        if report_title is None:
            meeting_type = structured_data.get('meeting_metadata', {}).get('type', 'Général')
            report_title = f"Compte-Rendu de Réunion - {meeting_type.title()}"
        
        # Create PDF document
        output_path = Path(output_filename)
        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=A4,
            rightMargin=2.5*cm,
            leftMargin=2.5*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )
        
        # Build content
        story = []
        
        # Add header
        story.extend(self._build_header(report_title))
        
        # Add metadata section
        story.extend(self._build_metadata_section(structured_data))
        
        # Add participants section
        story.extend(self._build_participants_section(structured_data))
        
        # Add summary section
        story.extend(self._build_summary_section(structured_data))
        
        # Add main content sections
        story.extend(self._build_content_sections(structured_data))
        
        # Add key points section
        story.extend(self._build_key_points_section(structured_data))
        
        # Add action items section
        story.extend(self._build_action_items_section(structured_data))
        
        # Add decisions section
        story.extend(self._build_decisions_section(structured_data))
        
        # Build PDF
        doc.build(story)
        
        print(f"✓ PDF report generated: {output_path}")
        return str(output_path)
    
    def _build_header(self, report_title):
        """Build report header"""
        elements = []
        
        # Organization name
        elements.append(Paragraph(self.organization_name, self.styles['OrgHeader']))
        elements.append(Spacer(1, 0.3*cm))
        
        # Report title
        elements.append(Paragraph(report_title, self.styles['ReportTitle']))
        elements.append(Spacer(1, 0.5*cm))
        
        # Horizontal line
        elements.append(Spacer(1, 0.2*cm))
        
        return elements
    
    def _build_metadata_section(self, data):
        """Build meeting metadata section"""
        elements = []
        
        metadata = data.get('meeting_metadata', {})
        
        # Meeting date - handle literal placeholder or missing date
        meeting_date = metadata.get('date', '')
        if not meeting_date or 'AAAA' in meeting_date or 'aaaa' in meeting_date:
            meeting_date = datetime.now().strftime('%d/%m/%Y')
        elements.append(Paragraph(f"<b>Date :</b> {meeting_date}", self.styles['MetadataText']))
        
        # Meeting type
        meeting_type = metadata.get('type', 'Réunion générale')
        elements.append(Paragraph(f"<b>Type :</b> {meeting_type}", self.styles['MetadataText']))
        
        # Duration estimate
        duration = metadata.get('duration_estimate', 'N/A')
        elements.append(Paragraph(f"<b>Durée estimée :</b> {duration}", self.styles['MetadataText']))
        
        elements.append(Spacer(1, 0.5*cm))
        
        return elements
    
    def _build_participants_section(self, data):
        """Build participants section"""
        elements = []
        
        participants = data.get('participants', [])
        
        if participants:
            elements.append(Paragraph("<b>Participants</b>", self.styles['SectionHeader']))  # Same in French
            
            for participant in participants:
                elements.append(Paragraph(f"• {participant}", self.styles['BulletText']))
            
            elements.append(Spacer(1, 0.4*cm))
        
        return elements
    
    def _build_summary_section(self, data):
        """Build meeting summary section"""
        elements = []
        
        summary = data.get('summary', '')
        
        if summary:
            elements.append(Paragraph("<b>Résumé de la réunion</b>", self.styles['SectionHeader']))
            elements.append(Paragraph(summary, self.styles['BodyText']))
            elements.append(Spacer(1, 0.3*cm))
        
        return elements
    
    def _build_content_sections(self, data):
        """Build main content sections"""
        elements = []
        
        sections = data.get('sections', [])
        
        if sections:
            elements.append(Paragraph("<b>Contenu de la réunion</b>", self.styles['SectionHeader']))
            
            for section in sections:
                title = section.get('title', 'Section sans titre')
                content = section.get('content', '')
                timestamp = section.get('timestamp', '')
                
                # Section title with optional timestamp
                if timestamp:
                    section_title = f"{title} <i>({timestamp})</i>"
                else:
                    section_title = title
                
                elements.append(Paragraph(section_title, self.styles['SubsectionHeader']))
                elements.append(Paragraph(content, self.styles['BodyText']))
                elements.append(Spacer(1, 0.2*cm))
        
        return elements
    
    def _build_key_points_section(self, data):
        """Build key points section"""
        elements = []
        
        key_points = data.get('key_points', [])
        
        if key_points:
            elements.append(Paragraph("<b>Points clés</b>", self.styles['SectionHeader']))
            
            for point in key_points:
                elements.append(Paragraph(f"• {point}", self.styles['BulletText']))
            
            elements.append(Spacer(1, 0.4*cm))
        
        return elements
    
    def _build_action_items_section(self, data):
        """Build action items section"""
        elements = []
        
        action_items = data.get('action_items', [])
        
        if action_items:
            elements.append(Paragraph("<b>Actions à mener</b>", self.styles['SectionHeader']))
            
            # Create table for action items
            table_data = [['Tâche', 'Responsable', 'Échéance']]
            
            for item in action_items:
                task = item.get('task', 'N/A')
                responsible = item.get('responsible', 'À définir')
                deadline = item.get('deadline', 'À définir')
                table_data.append([task, responsible, deadline])
            
            # Create table
            action_table = Table(table_data, colWidths=[8*cm, 4*cm, 3*cm])
            action_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5490')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f0f0')])
            ]))
            
            elements.append(action_table)
            elements.append(Spacer(1, 0.4*cm))
        
        return elements
    
    def _build_decisions_section(self, data):
        """Build decisions section"""
        elements = []
        
        decisions = data.get('decisions', [])
        
        if decisions:
            elements.append(Paragraph("<b>Décisions prises</b>", self.styles['SectionHeader']))
            
            for i, decision in enumerate(decisions, 1):
                elements.append(Paragraph(f"{i}. {decision}", self.styles['BodyText']))
            
            elements.append(Spacer(1, 0.4*cm))
        
        return elements


# ===========================
# USAGE EXAMPLE
# ===========================

if __name__ == "__main__":
    # Example structured data (from Gemini API - cedric_file2.py)
    sample_structured_data = {
        "meeting_metadata": {
            "date": "2024-01-15",
            "type": "Medical Team Meeting",
            "duration_estimate": "30 minutes"
        },
        "participants": [
            "Dr. Smith (Cardiologist)",
            "Dr. Johnson (Cardiac Surgeon)",
            "Nurse Martinez (Head Nurse, Cardiology)"
        ],
        "summary": "Medical team meeting to discuss cardiac care protocol updates and implementation timeline for the cardiology department.",
        "sections": [
            {
                "title": "Opening Remarks",
                "content": "Dr. Smith welcomed the team and introduced the meeting agenda focusing on patient care improvements for the cardiology department.",
                "timestamp": "00:00"
            },
            {
                "title": "Protocol Updates Discussion",
                "content": "Dr. Johnson presented the new cardiac care protocols including enhanced monitoring for post-operative patients and updated medication dosing guidelines. Implementation target set for next month.",
                "timestamp": "05:00"
            },
            {
                "title": "Staffing and Training",
                "content": "Nurse Martinez discussed staffing requirements for the new protocols. Proposed two training sessions for nursing staff scheduled for next week.",
                "timestamp": "15:00"
            }
        ],
        "key_points": [
            "New cardiac care protocols reviewed and approved",
            "Enhanced post-op monitoring to be implemented",
            "Updated medication dosing guidelines",
            "Training sessions scheduled for next week"
        ],
        "action_items": [
            {
                "task": "Prepare training materials for new protocols",
                "responsible": "Dr. Smith",
                "deadline": "End of this week"
            },
            {
                "task": "Organize training sessions for nursing staff",
                "responsible": "Nurse Martinez",
                "deadline": "Next week"
            },
            {
                "task": "Implement new protocols in cardiology department",
                "responsible": "All team members",
                "deadline": "Next month"
            }
        ],
        "decisions": [
            "New cardiac care protocols approved for implementation",
            "Training sessions to be held next week",
            "Implementation deadline set for next month"
        ]
    }
    
    # Initialize PDF generator
    pdf_generator = MeetingReportPDF(organization_name="Medical Center")
    
    # Generate PDF report
    output_file = pdf_generator.generate_report(
        structured_data=sample_structured_data,
        output_filename="meeting_report_example.pdf",
        report_title="Cardiology Department Meeting"
    )
    
    print(f"\n✓ Report generated successfully: {output_file}")
    
    # Example: Load structured data from JSON file
    """
    with open('structured_meeting.json', 'r', encoding='utf-8') as f:
        structured_data = json.load(f)
    
    pdf_generator.generate_report(structured_data, "final_report.pdf")
    """
