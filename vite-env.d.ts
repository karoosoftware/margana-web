/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_DISABLE_XOR_PRECHECK?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}