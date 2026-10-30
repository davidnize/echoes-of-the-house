import os
os.environ["TABPFN_DISABLE_TELEMETRY"] = "1"
import numpy as np
from tabpfn import TabPFNClassifier

X = np.array([[0, 1], [1, 1], [0, 0], [1, 0], [0, 1], [1, 0]])
y = np.array([1, 1, 0, 0, 1, 0])

clf = TabPFNClassifier(device="cpu")
clf.fit(X, y)
print(clf.predict_proba(np.array([[1, 1]])))
