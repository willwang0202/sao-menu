"""Extract the original Japanese face from its collection without changing glyphs."""
import sys
from fontTools.ttLib import TTCollection

collection = TTCollection(sys.argv[1], lazy=True)
collection.fonts[0].recalcTimestamp = False
collection.fonts[0].save(sys.argv[2])
