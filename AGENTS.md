# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# MadriListo

Datasets are plugins: a `DatasetDescriptor` in `src/data/datasets/` with a pure
`normalize`. Nothing in the UI, sync engine or storage layer should ever
special-case a specific dataset. See README.md for the full architecture.

Normalisation must stay free of React Native imports so it can be exercised
against a captured fixture outside a simulator.
