import { Common } from '@youwol/fv-code-mirror-editors'
import { IdeProject } from '@youwol/pyodide-helpers'

export type RawLog = IdeProject.JsonModels.RawLog
export type WorkersPool = IdeProject.JsonModels.WorkersPool
export type Environment = IdeProject.JsonModels.Environment
export type Project = IdeProject.JsonModels.Project
export type WorkerCommon = IdeProject.JsonModels.WorkerCommon

export type AbstractEnvImplementation = IdeProject.ExecutingImplementation
export type WorkersPoolImplementation =
    IdeProject.WorkersPool.WorkersPoolImplementation
export type MainThreadImplementation =
    IdeProject.MainThread.MainThreadImplementation

export type EnvironmentState<T extends AbstractEnvImplementation> =
    IdeProject.EnvironmentState<T, Common.IdeState>

export type MainThreadState = IdeProject.EnvironmentState<
    MainThreadImplementation,
    Common.IdeState
>

export type WorkersPoolState = IdeProject.EnvironmentState<
    WorkersPoolImplementation,
    Common.IdeState
>
export type AbstractEnvState = IdeProject.EnvironmentState<
    AbstractEnvImplementation,
    Common.IdeState
>
export type ProjectState = IdeProject.ProjectState<Common.IdeState>
