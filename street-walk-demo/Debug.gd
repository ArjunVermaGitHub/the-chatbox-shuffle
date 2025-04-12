# DebugTree.gd
extends Node

# Recursively prints the node tree.
func debug_print_tree(node: Node, indent: String = "") -> void:
	# Print the current node's name and its type (using get_class())
	print(indent + node.name + " (" + node.get_class() + ")")
	# Loop through each child and print its tree with increased indentation.
	for child in node.get_children():
		debug_print_tree(child, indent + "    ")

func _ready() -> void:
	# This prints the entire scene tree starting from the root node.
	var root = get_tree().get_root()
	debug_print_tree(root)
