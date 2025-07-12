document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM
    const searchInput = document.getElementById('searchInput');
    const sourceRadios = document.querySelectorAll('input[name="source"]');
    const searchResultsContainer = document.getElementById('searchResults');
    const orderListContainer = document.getElementById('orderList');
    const downloadBtn = document.getElementById('downloadCsvBtn');

    // Variables d'état
    let dataFolkestone = [];
    let dataVendome = [];
    let currentData = [];
    let orderList = [];
    let dataHeaders = [];

    // --- INITIALISATION ---
    Promise.all([
        fetch('data/mercuriale-folkestone.json').then(response => response.json()),
        fetch('data/mercuriale-vendome.json').then(response => response.json())
    ])
    .then(([folkestone, vendome]) => {
        dataFolkestone = folkestone;
        dataVendome = vendome;
        setCurrentDataSource('folkestone');
        console.log("Données chargées avec succès !");
    })
    .catch(error => {
        console.error("Erreur de chargement des fichiers JSON:", error);
        searchResultsContainer.innerHTML = `<p class="placeholder" style="color: red;">Erreur: Impossible de charger les fichiers de données. Avez-vous démarré l'application via un serveur local (Live Server) ?</p>`;
    });

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
    sourceRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            setCurrentDataSource(e.target.value);
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
            // MODIFICATION 1 : On récupère aussi la source de l'article
            const source = document.querySelector('input[name="source"]:checked').value;
            addProductToOrder(productCode, source);
        }
    });
    
    orderListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            const productCode = e.target.dataset.code;
            // MODIFICATION 1 : On récupère la source depuis l'attribut data-source
            const source = e.target.dataset.source;
            removeProductFromOrder(productCode, source);
        }
    });

    downloadBtn.addEventListener('click', downloadOrderAsCSV);

    // --- FONCTIONS LOGIQUES ---
    function setCurrentDataSource(source) {
        currentData = (source === 'vendome') ? dataVendome : dataFolkestone;
        if (currentData.length > 0) {
            dataHeaders = Object.keys(currentData[0]);
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
                        ${dataHeaders.map(header => `<th>${header}</th>`).join('')}
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(item => `
                        <tr>
                            ${dataHeaders.map(header => `<td>${item[header] || ''}</td>`).join('')}
                            <td><button class="btn-add" data-code="${item["Code Produit"]}">Ajouter</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        searchResultsContainer.innerHTML = tableHTML;
    }
    
    // MODIFICATION 1 : La fonction accepte la source en plus du code produit
    function addProductToOrder(productCode, source) {
        const productCodeStr = productCode.toString();

        // On vérifie le doublon en se basant sur le code ET la source
        if (orderList.some(p => p["Code Produit"].toString() === productCodeStr && p.source === source)) {
            alert(`Cet article de la mercuriale "${source}" est déjà dans la liste de commande.`);
            return;
        }

        const productToAdd = currentData.find(p => p["Code Produit"].toString() === productCodeStr);
        if (productToAdd) {
            // On ajoute une propriété 'source' à l'objet avant de le stocker
            const productWithSource = { ...productToAdd, source: source };
            orderList.push(productWithSource);
            renderOrderList();
        }
    }
    
    // MODIFICATION 1 : La fonction utilise le code ET la source pour trouver l'élément à retirer
    function removeProductFromOrder(productCode, source) {
        const productCodeStr = productCode.toString();
        // On filtre en excluant l'élément qui a le bon code ET la bonne source
        orderList = orderList.filter(p => 
            !(p["Code Produit"].toString() === productCodeStr && p.source === source)
        );
        renderOrderList();
    }

    function renderOrderList() {
        if (orderList.length === 0) {
            orderListContainer.innerHTML = `<p class="placeholder">Aucun article ajouté pour le moment.</p>`;
            downloadBtn.disabled = true;
            return;
        }

        // MODIFICATION 1 : Ajout d'une colonne "Source" pour différencier les articles
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
                            <td>${item.source}</td>
                            ${dataHeaders.map(header => `<td>${item[header] || ''}</td>`).join('')}
                            <td><button class="btn-remove" data-code="${item["Code Produit"]}" data-source="${item.source}">Retirer</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        orderListContainer.innerHTML = tableHTML;
        downloadBtn.disabled = false;
    }
    
    function downloadOrderAsCSV() {
        if (orderList.length === 0) return;

        // MODIFICATION 1 : Ajout de l'en-tête "Source" dans le CSV
        const headersWithSource = ['Source', ...dataHeaders];
        const csvHeaders = headersWithSource.join(';');
        
        const csvRows = orderList.map(row => {
            // On crée les cellules dans le bon ordre, en ajoutant la source au début
            const cells = [row.source, ...dataHeaders.map(header => {
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
    
    function updatePlaceholder() {
        const sourceName = document.querySelector('input[name="source"]:checked').parentElement.textContent.trim();
        searchResultsContainer.innerHTML = `<p class="placeholder">Commencez à taper pour rechercher dans "${sourceName}".</p>`;
    }
});