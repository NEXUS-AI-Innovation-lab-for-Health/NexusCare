def build_prompt(form, text: str) -> str:
    fields_description = []

    for field in form.fields:
        desc = f"- {field.name} ({field.label}"
        if field.semantic_hint:
            desc += f", {field.semantic_hint}"
        desc += ")"
        fields_description.append(desc)

    fields_block = "\n".join(fields_description)

    prompt = f"""
Tu es un moteur d'extraction d'informations.
Ta tâche est de remplir un formulaire à partir d'un texte.

Règles STRICTES :
- Retourne UNIQUEMENT du JSON valide
- Les clés doivent correspondre EXACTEMENT aux noms des champs
- Si une information est absente ou incertaine, mets null
- Toutes les valeurs doivent être des chaînes de caractères
- Ne fais aucune supposition

Formulaire :
{fields_block}

Texte :
\"\"\"{text}\"\"\"

Retour attendu (JSON uniquement) :
""".strip()

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