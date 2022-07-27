module.exports = () => ({
    projects: [
        {
            environment: {
                packages: ['numpy', 'pandas', 'scikit-learn'],
            },
            sources: [
                {
                    name: 'hello_world',
                    content: `
import numpy as np
a = np.arange(15).reshape(3, 5)
a                 
                `,
                },
            ],
        },
    ],
})
