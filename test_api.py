
import requests
import time
import sys

def test_api():
    base_url = "http://localhost:8000"
    
    # 1. Health Check
    print("Testing /health...")
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            print("Health check PASSED")
        else:
            print(f"Health check FAILED: {response.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"Health check ERROR: {e}")
        sys.exit(1)

    # 2. Predict Endpoint
    print("\nTesting /predict...")
    predict_payload = {
        "age": 65,
        "anaemia": 0,
        "creatinine_phosphokinase": 100,
        "diabetes": 1,
        "ejection_fraction": 30,
        "high_blood_pressure": 1,
        "platelets": 250000,
        "serum_creatinine": 1.2,
        "serum_sodium": 138,
        "sex": 1,
        "smoking": 0
    }
    try:
        response = requests.post(f"{base_url}/predict", json=predict_payload)
        if response.status_code == 200:
            data = response.json()
            if "1_day_risk" in data and "30_day_risk" in data:
                print("Predict PASSED")
                print(f"Risks: {data}")
            else:
                print(f"Predict FAILED: Missing keys in response {data}")
                sys.exit(1)
        else:
            print(f"Predict FAILED: {response.status_code}")
            print(response.text)
            sys.exit(1)
    except Exception as e:
        print(f"Predict ERROR: {e}")
        sys.exit(1)
        
    # 3. Query Endpoint
    print("\nTesting /query...")
    payload = {
        "question": "What are the treatments for heart failure with preserved ejection fraction?",
        "method": "etvd"
    }
    
    try:
        response = requests.post(f"{base_url}/query", json=payload)
        if response.status_code == 200:
            data = response.json()
            print("Query PASSED")
            print(f"Answer length: {len(data.get('answer', ''))}")
            print(f"Sources found: {len(data.get('sources', []))}")
        else:
            print(f"Query FAILED: {response.status_code}")
            print(response.text)
            sys.exit(1)
    except Exception as e:
        print(f"Query ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Wait a bit for server to fully start if running immediately after startup
    time.sleep(2)
    test_api()
