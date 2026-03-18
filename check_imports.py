
try:
    import xmltodict
    print("xmltodict: OK")
except ImportError as e:
    print(f"xmltodict: MISSING ({e})")

try:
    import langchain_community
    print("langchain_community: OK")
except ImportError as e:
    print(f"langchain_community: MISSING ({e})")

try:
    from langchain_community.tools import PubMedQueryRun
    print("PubMedQueryRun (top-level): OK")
except ImportError:
    print("PubMedQueryRun (top-level): MISSING")

try:
    import langchain_community.tools.pubmed as pubmed_module
    print(f"pubmed module dir: {dir(pubmed_module)}")
except ImportError as e:
    print(f"pubmed module import error: {e}")

