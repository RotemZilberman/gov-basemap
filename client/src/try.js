// make fewture requetst to https://www.govmap.gov.il/api/search-service/autocomplete with param: {"searchText":"הכפר 11","language":"he","isAccurate":false,"maxResults":10}

async function tryGovMap() {
    const response = await fetch('https://www.govmap.gov.il/api/search-service/autocomplete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            searchText: 'הכפר 11',
            language: 'he',
            isAccurate: false,
            maxResults: 10
        })
    });

    const data = await response.json();
    console.log(data);
}

tryGovMap();