import { CdnMessageEvent, LoadingScreenView } from '@youwol/cdn-client'
import {
    AssetsGateway,
    FilesBackend,
    AssetsBackend,
    ExplorerBackend,
} from '@youwol/http-clients'
import { downloadBlob, raiseHTTPErrors } from '@youwol/http-primitives'
import { forkJoin, Observable, Subject } from 'rxjs'
import { map, mergeMap, take, tap } from 'rxjs/operators'
import { defaultProject } from './default-project'
import { Project } from './models'

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
    permissionsInfo: AssetsBackend.GetPermissionsResponse
}> {
    const filesClient = new AssetsGateway.Client().files
    const assetsClient = new AssetsGateway.Client().assets
    const explorerClient = new AssetsGateway.Client().explorer

    const data$ = forkJoin([
        filesClient.getInfo$({ fileId: projectId }).pipe(raiseHTTPErrors()),
        explorerClient
            .getItem$({ itemId: window.btoa(projectId) })
            .pipe(raiseHTTPErrors()),
        assetsClient
            .getPermissions$({ assetId: window.btoa(projectId) })
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
        mergeMap(([fileInfo, explorerInfo, permissionsInfo, blob]) => {
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
                    permissionsInfo,
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
export function new$(loadingScreen: LoadingScreenView): Observable<{
    project: Project
    fileInfo: FilesBackend.GetInfoResponse
    permissionsInfo: AssetsBackend.GetPermissionsResponse
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
