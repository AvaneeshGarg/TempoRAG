
import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from src.tools import search_pubmed
from langchain_core.messages import HumanMessage, SystemMessage

load_dotenv(override=True)

def test_pubmed_context():
    if not os.environ.get("GROQ_API_KEY"):
        print("GROQ_API_KEY not found.")
        return

    llm = ChatGroq(model_name="llama-3.3-70b-versatile")
    tools = [search_pubmed]
    llm_with_tools = llm.bind_tools(tools)
    
    query = "latest treatments for heart failure"
    
    # Simulate the simplified system prompt from nodes.py
    system_msg = SystemMessage(content="""You are a clinical assistant.
    You have access to tools:
    1. 'predict_heart_failure_risk': For specific patient data.
    2. 'search_pubmed': For medical research and guidelines.

    Use them as needed to answer the user's question.
    """)
    
    # Simulate retrieved context
    context_str = """
    [1] Year: 2024 | Title: Pharmacological treatments for heart failure
    Review of SGLT2 inhibitors and their efficacy.
    
    [2] Year: 2023 | Title: Guidelines for HFpEF
    New recommendations include finerenone.
    """
    
    human_context = f"""Context:
    {context_str}
    
    Question: 
    {query}
    """
    
    messages = [system_msg, HumanMessage(content=human_context)]
    
    print(f"Testing query with context: {query}")
    
    try:
        response = llm_with_tools.invoke(messages)
        print("Response:", response)
        if response.tool_calls:
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
    test_pubmed_context()
