import os
import requests
from typing import List, Dict, Any

class ArxivValidator:
    def __init__(self):
        self.api_url = "http://export.arxiv.org/api/query"

    def search(self, keywords: List[str], max_results: int = 5) -> List[Dict[str, str]]:
        if not keywords:
            return []
        
        # Build query: all keywords must appear (AND logic)
        query = " AND ".join([f'all:"{k}"' for k in keywords])
        params = {
            "search_query": query,
            "start": 0,
            "max_results": max_results
        }
        
        try:
            response = requests.get(self.api_url, params=params, timeout=10)
            if response.status_code == 200:
                return self._parse_atom(response.text)
        except Exception as e:
            print(f"ArXiv API Error: {e}")
        return []

    def validate_pair(self, concept_a: str, concept_b: str) -> List[Dict[str, str]]:
        return self.search([concept_a, concept_b], max_results=3)

    def _parse_atom(self, xml_content: str) -> List[Dict[str, str]]:
        # Simple XML parsing to extract entry details
        # In production, use feedparser or xml.etree.ElementTree
        results = []
        try:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(xml_content)
            ns = {'atom': 'http://www.w3.org/2005/Atom'}
            
            for entry in root.findall('atom:entry', ns):
                title = entry.find('atom:title', ns).text.replace('\n', ' ').strip()
                summary = entry.find('atom:summary', ns).text.replace('\n', ' ').strip()
                id_val = entry.find('atom:id', ns).text
                link = entry.find('atom:link[@title="pdf"]', ns)
                url = link.attrib['href'] if link is not None else id_val
                
                authors = []
                for author in entry.findall('atom:author', ns):
                    authors.append(author.find('atom:name', ns).text)
                
                results.append({
                    "title": title,
                    "summary": summary[:200],
                    "url": url,
                    "authors": ", ".join(authors)
                })
        except Exception:
            pass
        return results
