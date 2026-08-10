history.pushState(null, null, location.href);
    window.addEventListener('popstate', function () { history.pushState(null, null, location.href); });

window.onload = () => {
    setTimeout(() => {
        document.getElementById('splashScreen').style.opacity = '0';
        setTimeout(() => { document.getElementById('splashScreen').style.display = 'none'; }, 500);
    }, 900);
    if(db.configs.exigirColaborador) {
        abrirSelecaoColaboradorInicial(false);
    } else {
        const admin = db.colaboradores.find(c => c.ativo !== false && c.isAdmin);
        db.configs.colabAtivoId = admin ? admin.id : null;
        iniciarApp();
    }
    if('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('./service-worker.js').catch(error => console.error('Falha ao ativar modo offline', error));
    }
};

function iniciarApp() {
    document.getElementById('seletorModo').value = db.configs.modo;
    document.getElementById('configExigirColab').checked = db.configs.exigirColaborador;
    alterarModo(db.configs.modo);
    atualizarEstadoSync(db.configs.url ? 'oculto' : 'local', db.configs.url ? 'Sincronização configurada' : 'Dados somente neste aparelho');
    setTimeout(() => sincronizarFundo(), 800);
}
