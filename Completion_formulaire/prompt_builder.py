def build_prompt(form, text: str) -> str:
    fields_description = []

    for field in form.fields:
        hint = field.semantic_hint if field.semantic_hint and field.semantic_hint != field.label else ""
        desc = f'- "{field.name}" | type: {field.type} | label: {field.label}'
        if hint:
            desc += f' | indice: {hint}'

        fields_description.append(desc)

    fields_block = "\n".join(fields_description)

    prompt = f"""Tu es un moteur d'extraction d'informations médicales.
Ta tâche : extraire les valeurs des champs d'un formulaire à partir d'une transcription vocale automatique.
IMPORTANT : la transcription peut contenir des erreurs de reconnaissance vocale (mots déformés, approximatifs ou mal orthographiés). Utilise le contexte sémantique et la ressemblance phonétique pour associer les informations aux bons champs même si les mots ne sont pas exacts.

Champs à remplir :
{fields_block}

Transcription :
\"\"\"{text}\"\"\"

Règles STRICTES :
- Retourne UNIQUEMENT du JSON valide, aucun texte autour
- Les clés JSON doivent être EXACTEMENT les noms des champs entre guillemets ci-dessus
- Si une information est absente, mets null. En cas de doute sur l'association, préfère extraire la valeur plutôt que mettre null
- Les champs de type "date" ou "datepicker" : format DD-MM-YYYY obligatoire
- Les champs de type "number" : valeur numérique uniquement
- Les champs de type "checkbox" : true ou false
- Les autres champs : chaîne de caractères

JSON :""".strip()

    return prompt

def build_prompt_for_field(field, text: str) -> str:
    """
    Crée un prompt optimisé pour extraire un seul champ
    """
    semantic_hint = field.semantic_hint or ""
    
    prompt = f"""Tu es un assistant d'extraction de données précis.

Extrais UNIQUEMENT la valeur du champ suivant du texte fourni:

Champ: {field.name}
Label: {field.label}
Type: {field.type}
Requis: {"Oui" if field.required else "Non"}
Indice sémantique: {semantic_hint}

Texte source:
{text}

Répondre UNIQUEMENT en JSON valide:
{{"value": "<la valeur extraite ou null>"}}

Règles:
- Si l'information n'existe pas, retourner {{"value": null}}
- Extraire UNIQUEMENT les données pertinentes pour ce champ
- Garder le format original du texte
"""
    return prompt