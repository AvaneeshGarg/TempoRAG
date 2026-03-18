import numpy as np
import datetime

def temporal_decay_weight(pub_year, lambda_decay=0.05) -> float:
    """
    E-TVD: Exponentially punishes older papers.
    exp(-lambda * age)
    """
    try:
        current_year = datetime.datetime.now().year
        year = int(pub_year)
        age = max(0, current_year - year)
        return float(np.exp(-lambda_decay * age))
    except:
        return 0.5 # Default if year is missing

def sigmoid_decay_weight(pub_year, threshold=10, steepness=0.5) -> float:
    """
    Sigmoid: Keeps scores high until 'threshold' years, then drops (The "Cliff").
    1 / (1 + e^(k * (age - threshold)))
    """
    try:
        current_year = datetime.datetime.now().year
        year = int(pub_year)
        age = max(0, current_year - year)
        weight = 1 / (1 + np.exp(steepness * (age - threshold)))
        return float(weight)
    except:
        return 0.5

def normalized_recency(pub_year, min_year=1980, max_year=None) -> float:
    """
    Normalizes year to [0,1] range for BioScore.
    """
    try:
        y = int(pub_year)
        if max_year is None: max_year = datetime.datetime.now().year
        y = np.clip(y, min_year, max_year)
        return float((y - min_year) / (max_year - min_year))
    except:
        return 0.0

def compute_bioscore(similarity, pub_year, alpha=0.7, beta=0.3) -> float:
    """
    BioScore: Linear combination of Similarity + Recency.
    """
    rec = normalized_recency(pub_year)
    return float(similarity * alpha + rec * beta)

def dist_to_similarity(dist) -> float:
    """
    Converts FAISS L2 distance to Similarity (0..1).
    """
    return float(1.0 / (1.0 + dist))
