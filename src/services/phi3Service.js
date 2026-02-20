const axios = require('axios');

const phi3 = {
    // Definimos el contexto de la base de datos para que la IA no cometa errores
    CONTEXTO_SISTEMA: `
        Eres un Analista Logístico experto. Tienes acceso a estas tablas en SQLite:
        - productos (id_prod, nombre, sku, precio_compra, stock_actual, stock_minimo, id_proveedor)
        - proveedores (id_prov, nombre, contacto, email, telefono)
        - historial_precios (id_hist, id_producto, precio_registrado, fecha)

        Tu objetivo es ayudar con resúmenes, auditoría de precios y logística. 
        Si el usuario te pide una lista o análisis, responde de forma profesional y estructurada.
    `,

    async preguntar(preguntaUsuario) {
        try {
            const response = await axios.post('http://localhost:11434/api/generate', {
                model: 'phi3', 
                // Combinamos el contexto maestro con la pregunta del usuario
                prompt: `${this.CONTEXTO_SISTEMA}\n\nUsuario solicita: ${preguntaUsuario}`,
                stream: false,
                options: {
                    temperature: 0.3, // Baja temperatura para respuestas más precisas y menos creativas
                    num_predict: 500  // Límite de tokens para evitar respuestas infinitas
                }
            });
            return response.data.response;
        } catch (error) {
            console.error('Error en el servicio Phi-3:', error.message);
            return "❌ Error de conexión: Verifica que Ollama esté corriendo con Phi-3.";
        }
    }
};

module.exports = phi3;