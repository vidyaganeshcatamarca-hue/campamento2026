export default function DebugTestPage() {
    return (
        <div className="p-10 text-center">
            <h1 className="text-4xl font-bold text-green-600">CONEXIÓN EXITOSA</h1>
            <p className="text-xl mt-4">Si ves esto, estás en la carpeta correcta y el servidor está actualizando.</p>
            <p className="text-gray-500 mt-2">Hora: {new Date().toISOString()}</p>
        </div>
    );
}
