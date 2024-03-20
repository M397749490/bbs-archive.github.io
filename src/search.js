import Papa from 'papaparse';
import { Segment, useDefault } from 'segmentit';
import { Archive } from 'libarchive.js/dist/libarchive';
Archive.init({
    workerUrl: 'src/libarchive/worker-bundle.js'
});

document.addEventListener('DOMContentLoaded', () => {

    // constants begin::
    const TD = {
        TID: 0,
        AUTHOR: 1,
        TIME: 2,
        TITLE: 3,
        REPLY: 4
    };
    const PER_PAGE = 25;
    const segmentit = useDefault(new Segment());
    const upstreamPath = '/src/';
    const fileName = 'mcbbs-brief.7z';
    const fileContentName = 'mcbbs-brief.csv';
    // constants end::

    // inits begin::
    const urlParams = new URLSearchParams(document.location.search);
    const searchWord = urlParams.get('s');
    if (urlParams.get('sort-by')) {
        document.getElementById("sort-by").value = urlParams.get('sort-by');
    }
    if (urlParams.get('sort-order')) {
        document.getElementById("sort-order").value = urlParams.get('sort-order');
    }
    const fullpath = `${upstreamPath}${fileName}`;
    const noticeEle = document.getElementById('notice');
    const loadingEle = document.getElementById('loading');
    const loadedEle = document.getElementById('loaded');
    const searchListEle = document.getElementById('search-list');
    const searchInputEle = document.getElementById('search-input');
    searchInputEle.value = searchWord;
    // inits ned::

    // functions begin::
    async function urlToFile(url, filename) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new File([blob], filename);
        } catch (error) {
            console.error('Error converting URL to File:', error);
            throw error;
        }
    }

    function readFileAsString(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                resolve(reader.result);
            };

            reader.onerror = () => {
                reject(reader.error);
            };

            reader.readAsText(file);
        });
    }
    const countWord = (row, word) => {
        return row[TD.AUTHOR] && row[TD.AUTHOR].includes(word) ||
            row[TD.TITLE] && row[TD.TITLE].includes(word)
    }

    function extractValues() {
        const params = new URLSearchParams(document.location.search);
        const searchWord = searchInputEle.value || params.get('s');
        const sortBy = document.getElementById("sort-by").value || params.get('sort-by');
        const sortOrder = document.getElementById("sort-order").value || params.get('sort-order');

        return {
            searchWord: searchWord,
            sortBy: sortBy,
            sortOrder: sortOrder,
        };
    }

    const keyOfRow = (sortBy) => {
        switch (sortBy) {
            case 'time':
                return TD.TIME
            case 'replies':
                return TD.REPLY
        }
    }

    const searchFunc = (data) => {
        const { searchWord, sortBy, sortOrder } = extractValues();
        const wordList = searchWord ? [searchWord, ...segmentit.doSegment(searchWord).map(item => item.w)] : [];
        searchListEle.innerHTML = '';
        const res = data.filter(row => {
            return wordList.some(word => countWord(row, word))
        });
        const cmpRow = (a, b) => {
            const ca = wordList.reduce((total, word) => (countWord(a, word) ? total + 1 : total), 0);
            const cb = wordList.reduce((total, word) => (countWord(b, word) ? total + 1 : total), 0);
            if (ca > cb) {
                return -1;
            } else if (ca === cb) {
                return 0;
            } else {
                return 1;
            }
        }

        res.sort((a, b) => {
            if (sortBy && sortOrder) {
                if (a[keyOfRow(sortBy)] === b[keyOfRow(sortBy)]) {
                    return cmpRow(a, b);
                } else if (a[keyOfRow(sortBy)] < b[keyOfRow(sortBy)]) {
                    return -1 * (Number(sortOrder === 'asc') ? 1 : -1);
                } else {
                    return 1 * (Number(sortOrder === 'asc') ? 1 : -1);
                }
            } else {
                return cmpRow(a, b)
            }
        })

        const paging = () => {
            searchListEle.append(...res.splice(0, PER_PAGE).map(row => {
                const [tid, author, time, title, reply] = row;
                const li = document.createElement('li');
                const h3 = document.createElement('h3');
                const a = document.createElement('a');
                a.href = `thread.html?t=${tid}`;
                a.textContent = title;;
                const p = document.createElement('p')
                p.textContent = `作者：${author} | 时间：${(new Date(time * 1000)).toLocaleString()} | 回复数：${reply}`
                h3.appendChild(a);
                li.appendChild(h3);
                li.appendChild(p);
                return li;
            }));
        };
        if (!res.length) {
            if (!searchWord) {
                searchListEle.textContent = '搜到的内容将会在此显示';
            } else {
                searchListEle.textContent = '暂时没有搜到任何内容哦'
            }
        }
        paging();
        const showMoreBtn = document.getElementById('show-more');
        if (!res.length) {
            showMoreBtn.classList.add('hidden');
        }
        showMoreBtn.addEventListener('click', () => {
            if (res.length) {
                paging();
            } else {
                showMoreBtn.textContent = '已经没有了哦';
                showMoreBtn.disabled = true;
            }
        })
    }
    // functions end::
    (async () => {
        noticeEle.textContent = '正在下载搜索索引文件。\n因为 jsdelivr CDN 受到神秘力量干涉，\n最好使用魔法方式连接';
        try {
            const file = await urlToFile(fullpath);
            noticeEle.textContent = '正在解析文件。搜索可能需要一点时间，请耐心等待。';
            const archive = await Archive.open(file);
            const obj = await archive.extractFiles();
            const content = await readFileAsString(obj[fileContentName]);
            /** @type {Array<Array<String>>} */
            // const data = await parseCSV(fullpath);
            const data = Papa.parse(content).data;
            data.shift();
            loadingEle.classList.add('hidden');
            loadedEle.classList.remove('hidden');
            searchFunc(data);
            const jumpToSearch = () => {
                const { searchWord, sortBy, sortOrder } = extractValues();
                const params = new URLSearchParams();
                params.append('s', searchWord)
                if (sortBy && sortOrder) {
                    params.append('sort-by', sortBy);
                    params.append('sort-order', sortOrder);
                }
                window.history.pushState({}, 'Search - bbs-archive', `search.html?${params.toString()}`)
                searchFunc(data);
            }

            document.getElementById('btn-search').addEventListener('click', () => {
                jumpToSearch();
            });
            searchInputEle.onkeydown = (event) => {
                if (event.key === 'Enter') {
                    jumpToSearch();
                }
            };
            document.getElementById("sort-by").onchange = (event) => {
                jumpToSearch();
            };
            document.getElementById("sort-order").onchange = (event) => {
                jumpToSearch();
            };
        } catch (err) {
            loadingEle.textContent = err;
            return;
        }
    })();
})
