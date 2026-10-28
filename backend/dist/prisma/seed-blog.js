"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const articles = [
    {
        slug: 'zonas-en-crecimiento-en-caba-para-invertir-en-2024',
        title: 'Zonas en crecimiento en CABA para invertir en 2024',
        excerpt: 'Descubri los barrios con mayor proyeccion y por que son una buena oportunidad.',
        category: client_1.BlogArticleCategory.COMPRA,
        coverImageUrl: 'https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1200&q=80',
        readingMinutes: 5,
        relatedSearchPrompt: 'Busco departamentos para comprar en zonas con potencial de crecimiento en CABA.',
        contentJson: [
            {
                body: 'La Ciudad de Buenos Aires sigue siendo uno de los mercados inmobiliarios mas activos de la region. En este articulo analizamos barrios con mayor proyeccion de crecimiento y por que pueden ser una oportunidad de inversion.',
            },
            {
                heading: '1. Palermo',
                body: 'Palermo mantiene liquidez alta, demanda constante y una oferta diversa. Es una zona competitiva, pero sigue siendo referencia para unidades chicas y alquiler temporario.',
            },
            {
                heading: '2. Caballito',
                body: 'Caballito combina conectividad, servicios y una demanda familiar estable. Para perfiles conservadores puede funcionar como punto medio entre precio, ubicacion y profundidad de mercado.',
            },
        ],
    },
    {
        slug: 'como-saber-si-estas-pagando-un-alquiler-caro',
        title: 'Como saber si estas pagando un alquiler caro',
        excerpt: 'Claves para analizar el precio y tomar mejores decisiones antes de renovar.',
        category: client_1.BlogArticleCategory.TIPS,
        coverImageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
        readingMinutes: 4,
        relatedSearchPrompt: 'Quiero comparar alquileres similares en mi zona para saber si el precio esta bien.',
        contentJson: [
            {
                body: 'Para entender si un alquiler esta caro no alcanza con mirar un solo aviso. Conviene comparar unidades equivalentes por zona, ambientes, estado, expensas y amenities.',
            },
            {
                heading: 'Compara contra propiedades equivalentes',
                body: 'La comparacion debe hacerse con unidades similares. Un dos ambientes reciclado con balcon no deberia compararse contra uno interno sin luz natural.',
            },
        ],
    },
    {
        slug: 'rentabilidad-por-barrio-donde-conviene-invertir-hoy',
        title: 'Rentabilidad por barrio: donde conviene invertir hoy',
        excerpt: 'Analizamos los barrios con mejores retornos en alquiler.',
        category: client_1.BlogArticleCategory.INVERSION,
        coverImageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
        readingMinutes: 6,
        relatedSearchPrompt: 'Busco propiedades para invertir con buena rentabilidad por alquiler.',
        contentJson: [
            {
                body: 'La rentabilidad depende del precio de compra, el alquiler esperado, los gastos y la velocidad para conseguir inquilino. No siempre el barrio mas caro ofrece el mejor retorno.',
            },
            {
                heading: 'Ticket de entrada',
                body: 'Barrios con precios de compra mas accesibles pueden mejorar el rendimiento relativo si sostienen buena demanda de alquiler.',
            },
        ],
    },
    {
        slug: 'que-documentos-te-pueden-pedir-para-alquilar',
        title: 'Que documentos te pueden pedir para alquilar',
        excerpt: 'Una guia simple para preparar papeles antes de reservar.',
        category: client_1.BlogArticleCategory.ALQUILER,
        coverImageUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
        readingMinutes: 3,
        relatedSearchPrompt: 'Quiero buscar alquileres y priorizar opciones con requisitos simples.',
        contentJson: [
            {
                body: 'Preparar documentacion antes de visitar ayuda a reservar mas rapido. Cada anunciante puede pedir requisitos distintos, pero hay patrones frecuentes.',
            },
            {
                heading: 'Ingresos y garantia',
                body: 'Suelen solicitar comprobantes de ingresos, garantia propietaria, seguro de caucion o recibos de sueldo.',
            },
        ],
    },
];
async function main() {
    const fallbackAdmin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true },
    });
    for (const article of articles) {
        await prisma.blogArticle.upsert({
            where: { slug: article.slug },
            update: {
                ...article,
                authorId: fallbackAdmin?.id ?? null,
                status: client_1.BlogArticleStatus.PUBLISHED,
                publishedAt: new Date('2026-04-24T12:00:00.000Z'),
            },
            create: {
                ...article,
                authorId: fallbackAdmin?.id ?? null,
                status: client_1.BlogArticleStatus.PUBLISHED,
                publishedAt: new Date('2026-04-24T12:00:00.000Z'),
            },
        });
    }
    const now = new Date();
    const sources = [
        { source: 'Argenprop', status: client_1.ScrapingSourceHealthStatus.ACTIVE, resultsCount: 1256, minutesAgo: 10, errorSummary: null },
        { source: 'Mudafy', status: client_1.ScrapingSourceHealthStatus.ACTIVE, resultsCount: 842, minutesAgo: 15, errorSummary: null },
        { source: 'Properati', status: client_1.ScrapingSourceHealthStatus.EXPERIMENTAL, resultsCount: 1923, minutesAgo: 20, errorSummary: null },
        { source: 'Zonaprop', status: client_1.ScrapingSourceHealthStatus.BLOCKED, resultsCount: 0, minutesAgo: 1020, errorSummary: 'Fuente bloqueada temporalmente' },
    ];
    for (const source of sources) {
        await prisma.scrapingSourceStatus.upsert({
            where: { source: source.source },
            update: {
                status: source.status,
                resultsCount: source.resultsCount,
                lastRunAt: new Date(now.getTime() - source.minutesAgo * 60_000),
                errorSummary: source.errorSummary,
            },
            create: {
                source: source.source,
                status: source.status,
                resultsCount: source.resultsCount,
                lastRunAt: new Date(now.getTime() - source.minutesAgo * 60_000),
                errorSummary: source.errorSummary,
            },
        });
    }
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
});
