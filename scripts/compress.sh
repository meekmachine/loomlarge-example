#!/bin/bash
set -e

INPUT="/Users/jonathan/Novembre/LoomLarge/public/characters/jonathan.glb"
OUTPUT="/Users/jonathan/Novembre/LoomLarge/public/characters/jonathan_compressed.glb"
SCRIPT="/Users/jonathan/Novembre/LoomLarge/scripts/compress_glb.py"

echo "Compressing GLB file with Blender..."
/Applications/Blender.app/Contents/MacOS/Blender --background --python "$SCRIPT" -- "$INPUT" "$OUTPUT"

echo ""
echo "Compression complete!"
