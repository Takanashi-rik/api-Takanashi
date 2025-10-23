module.exports = function (app) {

function listRoutes() {
    let anuan = app._router.stack
        .filter(layer => layer.route)
        .map(layer => ({
            method: Object.keys(layer.route.methods).join(', ').toUpperCase(),
            path: layer.route.path
        }))
    return anuan.length - 1
}

function runtime(seconds) {
    seconds = Math.floor(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

app.get('/api/status', async (req, res) => {
    try {
        res.status(200).json({
            status: true,
            creator: "Takanashi",
            result: {
                status: "Aktif",
                totalrequest: global.totalreq?.toString() || "0",
                totalfitur: `${listRoutes()}`,
                error: global.errorTracker?.getCount()?.toString() || "0",
                runtime: runtime(process.uptime()),
                domain: req.hostname
            }
        })
    } catch (error) {
        global.errorTracker?.increment();
        
        res.status(500).json({
            status: false,
            creator: "Takanashi",
            message: `Terjadi kesalahan internal: ${error.message}`
        })
    }
})

app.get('/api/reset-errors', async (req, res) => {
    try {
        const previousCount = global.errorTracker.getCount();
        global.errorTracker.reset();
        
        res.status(200).json({
            status: true,
            creator: "Takanashi",
            message: `Error count reset from ${previousCount} to 0`
        })
    } catch (error) {
        global.errorTracker?.increment();
        res.status(500).json({
            status: false,
            creator: "Takanashi",
            message: `Terjadi kesalahan: ${error.message}`
        })
    }
})
}