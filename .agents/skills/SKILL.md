---
name: create-custom-directory
description: A skill that defines the Google best practices for creating and structuring custom directories in this project.
---

# Custom Directory Creation Skill

This skill outlines the standard operating procedure and best practices for creating new custom directories in this project. When tasked with creating a new directory structure for a feature or module, you **MUST** follow these guidelines.

## 1. Directory Naming Conventions

*   **Kebab-case:** Use `kebab-case` for all directory names (e.g., `user-profile`, `data-models`).
*   **Descriptive:** Names should clearly describe the contents or purpose of the directory.
*   **Singular vs. Plural:** Use plural nouns for directories containing collections of similar items (e.g., `components`, `utils`, `models`), and singular for specific feature modules (e.g., `auth`, `billing`).

## 2. Standard Subdirectories

When creating a complex custom feature directory, consider if it requires any of the standard subdirectories:

*   `scripts/`: For helper scripts and utilities that extend capabilities.
*   `examples/`: For reference implementations and usage patterns.
*   `resources/`: For additional files, templates, or assets the skill may reference.
*   `references/`: For additional documentation.

## 3. Best Practices

*   **Modularity:** Keep directories self-contained. A custom directory should ideally represent a distinct bounded context or feature.
*   **No Deep Nesting:** Avoid excessively deep directory trees. If a directory is nested more than 3-4 levels deep, consider flattening the structure.
*   **Documentation:** If the directory serves a complex purpose, include a `README.md` file at its root to explain its role within the project.

## 4. Example Usage

If instructed to "create a custom directory for a new skill", you should:
1.  Determine the name (e.g. `payment-processing`).
2.  Create the directory: `mkdir payment-processing`.
3.  Add standard subdirectories if needed: `mkdir payment-processing/scripts payment-processing/examples`.
4.  Add a `SKILL.md` inside `payment-processing/` explaining the module.
