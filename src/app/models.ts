import { VirtualDOM } from '@youwol/flux-view'

export interface Source {
    path: string
    content: string
}

export interface Requirements {
    pythonPackages: string[]
    javascriptPackages: { modules: string[]; aliases: { [k: string]: string } }
}

export interface RunConfiguration {
    name: string
    scriptPath: string
    parameters?: string
}

export interface Environment {
    requirements: Requirements
    configurations: RunConfiguration[]
}

export interface WorkersPool {
    id: string
    name: string
    environment: Environment
    sources: Source[]
}

export interface Project {
    id: string
    name: string
    environment: Environment
    sources: Source[]
    workersPools?: WorkersPool[]
}

export interface WorkerCommon {
    id: string
    name: string
    environment: Environment
    sources: Source[]
}

export interface RawLog {
    level: 'info' | 'warning' | 'error'
    message: string
    data?: unknown
}

export interface View {
    name: string
    htmlElement: VirtualDOM | HTMLElement
}
