document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const searchInput = document.getElementById('searchInput');
    const sourceCheckboxes = document.querySelectorAll('input[name="source"]');
    const searchResultsContainer = document.getElementById('searchResults');
    const orderListContainer = document.getElementById('orderList');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    const downloadXlsxBtn = document.getElementById('downloadXlsxBtn');

    // Data
    let dataFolkestone = [];
    let dataVendome = [];
    let dataWashington = [];
    let currentData = [];
    let orderList = [];
    let dataHeaders = [];

    // --- INITIALISATION : Charger les données ---
    Promise.all([
        fetch('data/mercuriale-folkestone.json').then(r => r.json()),
        fetch('data/mercuriale-vendome.json').then(r => r.json()),
        fetch('data/mercuriale-washington.json').then(r => r.json())
    ])
    .then(([folkestone, vendome, washington]) => {
        dataFolkestone = folkestone;
        dataVendome = vendome;
        dataWashington = washington;
        updateCurrentData();
        console.log("Données chargées avec succès !");
    })
    .catch(error => {
        console.error("Erreur de chargement des fichiers JSON:", error);
        searchResultsContainer.innerHTML = `<p class="placeholder" style="color: red;">Erreur : Impossible de charger les fichiers de données. <br> Démarrez l'application via un serveur local (ex: python -m http.server)</p>`;
    });

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
    sourceCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateCurrentData();
            searchInput.value = '';
            displaySearchResults([]);
        });
    });

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length < 2) {
            displaySearchResults([]);
            return;
        }
        const results = currentData.filter(item => {
            const codeProduit = item["Code Produit"]?.toString().toLowerCase() || '';
            const libelleProduit = item["Libellé produit"]?.toString().toLowerCase() || '';
            return codeProduit.includes(query) || libelleProduit.includes(query);
        });
        displaySearchResults(results);
    });

    searchResultsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-add')) {
            const productCode = e.target.dataset.code;
            const source = e.target.dataset.source;
            addProductToOrder(productCode, source);
        }
    });

    orderListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            const productCode = e.target.dataset.code;
            const source = e.target.dataset.source;
            removeProductFromOrder(productCode, source);
        }
    });

    downloadCsvBtn.addEventListener('click', downloadOrderAsCSV);
    downloadXlsxBtn.addEventListener('click', downloadOrderAsXLSX);

    // --- FONCTIONS ---
    function getSelectedSources() {
        return Array.from(document.querySelectorAll('input[name="source"]:checked')).map(cb => cb.value);
    }

    function updateCurrentData() {
        const selectedSources = getSelectedSources();
        let mergedData = [];
        if (selectedSources.includes('folkestone')) mergedData = mergedData.concat(dataFolkestone.map(x => ({...x, _source: 'Folkestone'})));
        if (selectedSources.includes('vendome')) mergedData = mergedData.concat(dataVendome.map(x => ({...x, _source: 'Vendôme'})));
        if (selectedSources.includes('washington')) mergedData = mergedData.concat(dataWashington.map(x => ({...x, _source: 'Washington'})));
        currentData = mergedData;
        if (currentData.length > 0) {
            dataHeaders = Object.keys(currentData[0]).filter(h => h !== '_source');
        }
        updatePlaceholder();
    }

    function displaySearchResults(results) {
        if (results.length === 0) {
            updatePlaceholder();
            return;
        }
        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Source</th>
                        ${dataHeaders.map(header => `<th>${header}</th>`).join('')}
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(item => `
                        <tr>
                            <td>${item._source}</td>
                            ${dataHeaders.map(header => `<td>${item[header] || ''}</td>`).join('')}
                            <td>
                                <button class="btn-add" data-code="${item["Code Produit"]}" data-source="${item._source}">Ajouter</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        searchResultsContainer.innerHTML = tableHTML;
    }

    function addProductToOrder(productCode, source) {
        const productCodeStr = productCode.toString();
        if (orderList.some(p => p["Code Produit"].toString() === productCodeStr && p._source === source)) {
            alert(`Cet article de la mercuriale "${source}" est déjà dans la liste de commande.`);
            return;
        }
        const productToAdd = currentData.find(p => p["Code Produit"].toString() === productCodeStr && p._source === source);
        if (productToAdd) {
            orderList.push({...productToAdd});
            renderOrderList();
        }
    }

    function removeProductFromOrder(productCode, source) {
        const productCodeStr = productCode.toString();
        orderList = orderList.filter(p => !(p["Code Produit"].toString() === productCodeStr && p._source === source));
        renderOrderList();
    }

    function renderOrderList() {
        if (orderList.length === 0) {
            orderListContainer.innerHTML = `<p class="placeholder">Aucun article ajouté pour le moment.</p>`;
            downloadCsvBtn.disabled = true;
            downloadXlsxBtn.disabled = true;
            return;
        }
        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Source</th>
                        ${dataHeaders.map(header => `<th>${header}</th>`).join('')}
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${orderList.map(item => `
                        <tr>
                            <td>${item._source}</td>
                            ${dataHeaders.map(header => `<td>${item[header] || ''}</td>`).join('')}
                            <td>
                                <button class="btn-remove" data-code="${item["Code Produit"]}" data-source="${item._source}">Retirer</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        orderListContainer.innerHTML = tableHTML;
        downloadCsvBtn.disabled = false;
        downloadXlsxBtn.disabled = false;
    }

    function downloadOrderAsCSV() {
        if (orderList.length === 0) return;
        const headersWithSource = ['Source', ...dataHeaders];
        const csvHeaders = headersWithSource.join(';');
        const csvRows = orderList.map(row => {
            const cells = [row._source, ...dataHeaders.map(header => {
                let cell = row[header] === null || row[header] === undefined ? '' : row[header];
                cell = cell.toString().replace(/"/g, '""');
                if (cell.includes(';') || cell.includes('"') || cell.includes('\n')) {
                    cell = `"${cell}"`;
                }
                return cell;
            })];
            return cells.join(';');
        });
        const csvContent = "\uFEFF" + [csvHeaders, ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'ma_commande.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function downloadOrderAsXLSX() {
        if (orderList.length === 0) return;
        const wsData = [
            ['Source', ...dataHeaders],
            ...orderList.map(row => [row._source, ...dataHeaders.map(h => row[h] || '')])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Commande");
        XLSX.writeFile(wb, "ma_commande.xlsx");
    }

    function updatePlaceholder() {
        const selected = getSelectedSources();
        let sourceName = selected.length > 0
            ? selected.map(src => ({
                'folkestone': 'Folkestone',
                'vendome': 'Vendôme',
                'washington': 'Washington'
              })[src] || src).join(', ')
            : 'aucune mercuriale';
        searchResultsContainer.innerHTML = `<p class="placeholder">Commencez à taper pour rechercher dans : <strong>${sourceName}</strong>.</p>`;
    }
});
