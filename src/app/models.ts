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
    parameters: string
}

export interface Environment {
    requirements: Requirements
    configurations: RunConfiguration[]
}

export interface Project {
    id: string
    name: string
    environment: Environment
    sources: Source[]
}

export interface Workspace {
    projects: Project[]
}

export type InstallStep =
    | 'queued'
    | 'loading'
    | 'loaded'
    | 'installing'
    | 'installed'

export interface ProjectEvent {
    projectId: string
}

export interface InstallMessageEvent extends ProjectEvent {
    packageName: string
    step: InstallStep
}

export interface RawLog {
    level: 'info' | 'warning' | 'error'
    message: string
    data?: any
}
