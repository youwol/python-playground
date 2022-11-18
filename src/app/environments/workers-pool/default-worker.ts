import { WorkersPool } from '../../models'
import { v4 as uuidv4 } from 'uuid'

export const defaultWorkerSrc = `
from yw_pyodide.worker.IO import input_stream, output_stream

def compute(d, output):
    output_stream.send_data(len(d))
    
input_stream.on_data( lambda d: compute(d, output_compute) )
`

export function getDefaultWorker({ name }: { name: string }): WorkersPool {
    return {
        id: `${uuidv4()}`,
        name,
        capacity: 2,
        environment: {
            requirements: {
                pythonPackages: [],
                javascriptPackages: {
                    modules: [],
                    aliases: {},
                },
            },
            configurations: [
                {
                    name: 'default',
                    scriptPath: './worker_entry.py',
                },
            ],
        },
        sources: [
            {
                path: './worker_entry.py',
                content: defaultWorkerSrc,
            },
        ],
    }
}
