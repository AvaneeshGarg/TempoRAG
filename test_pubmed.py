
import os
from dotenv import load_dotenv

load_dotenv(override=True)
print(f"DEBUG: GROQ_API_KEY loaded? {bool(os.environ.get('GROQ_API_KEY'))}")
print(f"DEBUG: Key starts with: {os.environ.get('GROQ_API_KEY', '')[:10]}...")

from langchain_groq import ChatGroq
from src.tools import search_pubmed
from langchain_core.messages import HumanMessage

def test_pubmed():
    if not os.environ.get("GROQ_API_KEY"):
        print("GROQ_API_KEY not found.")
        return

    llm = ChatGroq(model_name="llama-3.3-70b-versatile")
    tools = [search_pubmed]
    llm_with_tools = llm.bind_tools(tools)
    
    query = "latest treatments for heart failure"
    print(f"Testing query: {query}")
    
    try:
        response = llm_with_tools.invoke([HumanMessage(content=query)])
        print("Response:", response)
        if response.tool_calls:
            print("Tool Calls:", response.tool_calls)
            for tool_call in response.tool_calls:
                args = tool_call["args"]
                print(f"Executing tool with args: {args}")
                result = search_pubmed.invoke(args)
                print("Result preview:", str(result)[:200])
        else:
            print("No tool calls generated.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_pubmed()
