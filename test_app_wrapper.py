import pandas as pd
import vibe_widget as vw

df = pd.DataFrame({
    'category': ['A', 'B', 'C', 'D', 'E'],
    'value': [23, 45, 12, 67, 34]
})

widget = vw.create("Create an interactive bar chart showing category values", df)
