import { CdnMessageEvent, install, LoadingScreenView } from '@youwol/cdn-client'
import {
    AssetsGateway,
    FilesBackend,
    ExplorerBackend,
    downloadBlob,
    raiseHTTPErrors,
} from '@youwol/http-clients'
import { forkJoin, Observable, Subject } from 'rxjs'
import { map, mergeMap, take, tap } from 'rxjs/operators'
import { Project, Requirements } from './models'
import { defaultProject } from './default-project'
import { Environment } from './project'

/**
 *
 * @param projectId id of the project to load
 * @param loadingScreen loading screen to append loading events
 * @returns application state & application view
 */
export function load$(
    projectId: string,
    loadingScreen: LoadingScreenView,
): Observable<{
    project: Project
    fileInfo: FilesBackend.GetInfoResponse
    explorerInfo: ExplorerBackend.GetItemResponse
}> {
    const filesClient = new AssetsGateway.Client().files

    const explorerClient = new AssetsGateway.Client().explorer

    const data$ = forkJoin([
        filesClient.getInfo$({ fileId: projectId }).pipe(raiseHTTPErrors()),
        explorerClient
            .getItem$({ itemId: window.btoa(projectId) })
            .pipe(raiseHTTPErrors()),
        downloadBlob(
            `${
                filesClient.basePath
            }/files/${projectId}?timestamp=${Date.now()}`,
            projectId,
            {},
        ).pipe(raiseHTTPErrors(), take(1)),
    ])
    return data$.pipe(
        tap(() => {
            loadingScreen.next(
                new CdnMessageEvent('fetch_project', 'Project retrieved'),
            )
        }),
        mergeMap(([fileInfo, explorerInfo, blob]) => {
            const jsonResp = new Subject()
            const reader = new FileReader()
            reader.onload = (ev) => {
                jsonResp.next(JSON.parse(ev.target.result as string))
            }
            reader.readAsText(blob)
            return jsonResp.pipe(
                take(1),
                map((project: Project) => ({
                    project: { ...project, id: explorerInfo.rawId },
                    fileInfo,
                    explorerInfo,
                })),
            )
        }),
    )
}

/**
 *
 * @param loadingScreen loading screen to append loading events
 * @returns application state & application view
 */
export function new$(
    loadingScreen: LoadingScreenView,
): Observable<{
    project: Project
    fileInfo: FilesBackend.GetInfoResponse
    explorerInfo: ExplorerBackend.GetItemResponse
}> {
    const client = new AssetsGateway.AssetsGatewayClient()
    loadingScreen.next(
        new CdnMessageEvent(
            'create-tmp-project',
            'Create temporary project...',
        ),
    )
    const str = JSON.stringify(defaultProject)
    const bytes = new TextEncoder().encode(str)
    const blob = new Blob([bytes], {
        type: 'application/json;charset=utf-8',
    })

    return client.explorer.getDefaultUserDrive$().pipe(
        raiseHTTPErrors(),
        mergeMap((defaultDrive) => {
            return client.files
                .upload$({
                    body: {
                        fileName: `project-${new Date().toLocaleString()}.pyplay.json`,
                        content: blob,
                    },
                    queryParameters: { folderId: defaultDrive.tmpFolderId },
                })
                .pipe(raiseHTTPErrors())
        }),
        map(
            (
                resp: AssetsGateway.NewAssetResponse<FilesBackend.UploadResponse>,
            ) => ({ ...defaultProject, id: resp.rawId }),
        ),
        tap(() => {
            loadingScreen.next(
                new CdnMessageEvent(
                    'create-tmp-project',
                    'Temporary project created',
                ),
            )
        }),
        mergeMap(({ id }) => load$(id, loadingScreen)),
    )
}

export async function installRequirements({
    requirements,
    cdnEvent$,
    rawLog$,
    environment$,
}: {
    requirements: Requirements
    cdnEvent$
    rawLog$
    environment$: Subject<Environment>
}) {
    const exportedPyodideInstanceName = Environment.ExportedPyodideInstanceName
    await install({
        ...requirements.javascriptPackages,
        customInstallers: [
            {
                module: '@youwol/cdn-pyodide-loader',
                installInputs: {
                    modules: requirements.pythonPackages.map(
                        (p) => `@pyodide/${p}`,
                    ),
                    warmUp: true,
                    onEvent: (cdnEvent) => cdnEvent$.next(cdnEvent),
                    exportedPyodideInstanceName,
                },
            },
        ],
        onEvent: (cdnEvent) => {
            cdnEvent$.next(cdnEvent)
        },
    })

    const pyodide = window[exportedPyodideInstanceName]

    Object.entries(requirements.javascriptPackages.aliases).forEach(
        ([alias, originalName]) => {
            rawLog$.next({
                level: 'info',
                message: `create alias '${alias}' to import '${originalName}' (version ${window[alias].__yw_set_from_version__}) `,
            })
            pyodide.registerJsModule(alias, window[alias])
        },
    )
    environment$.next(
        new Environment({
            pyodide,
        }),
    )
    //projectLoaded$.next(true)
}
