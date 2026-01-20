import json
import sys
import os
import hashlib
from datetime import datetime
from .agent import CrossAssociationAgent
from .providers import get_llm

def load_env():
    env_path = os.path.join(os.getcwd(), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

def generate_filename(username="user"):
    timestamp = datetime.now().strftime("%Y%m%d%H%M")
    # Generate a random-like hash based on time and username
    raw = f"{timestamp}_{username}"
    hash_val = hashlib.sha256(raw.encode()).hexdigest()
    return f"{timestamp}_{username}_{hash_val}.txt"

def main():
    if len(sys.argv) < 2:
        print("用法: python -m WY.cli 概念")
        return
    
    load_env()
    concept = sys.argv[1]
    
    llm = get_llm()
    agent = CrossAssociationAgent(llm=llm, disciplines=None)
    res = agent.run(concept)
    
    output_content = json.dumps(res, ensure_ascii=False, indent=2)
    filename = generate_filename()
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(output_content)
        
    print(filename)

if __name__ == "__main__":
    main()
