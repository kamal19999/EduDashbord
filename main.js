let subjectAverageChart, gradeDistributionChart, gradeStudentDistributionChart, averageGradeByClassChart;
let allStudentsData = [];

let subjectLabels = {}; // Will be populated dynamically
let subjectKeys = []; // Will be populated dynamically

const getGradeCategory = (score) => {
    if (score === 0) return 'الغياب'; // New category for zero scores
    if (score >= 90) return 'ممتاز';
    if (score >= 80) return 'جيد جداً';
    if (score >= 65) return 'جيد';
    if (score >= 50) return 'مقبول';
    return 'ضعيف';
};

const chartColors = {
    grades: ['#059669', '#2563eb', '#fbbf24', '#a78bfa', '#ef4444', '#000000'] // ممتاز، جيد جداً، جيد، مقبول، ضعيف, الغياب
};

// Function to generate a consistent set of colors for dynamic subjects
const generateColors = (numColors) => {
    const colors = [];
    const hueStep = 360 / numColors;
    for (let i = 0; i < numColors; i++) {
        const hue = (i * hueStep + 120) % 360; // Start with a green-ish hue and cycle
        colors.push(`hsl(${hue}, 70%, 50%)`);
    }
    return colors;
};

let dynamicSubjectColors = []; // To store generated colors

// Helper function to get selected values from multi-select dropdowns
const getSelectedFilterValues = (filterId) => {
    const checkboxes = document.querySelectorAll(`#${filterId}Dropdown input[type="checkbox"]:checked`);
    const values = Array.from(checkboxes).map(cb => cb.value);
    if (values.includes('الكل') || values.length === 0) {
        return ['الكل'];
    }
    return values;
};

// Helper function to update the display text of multi-select buttons
const updateFilterDisplay = (filterId, selectedValues) => {
    const displayElement = document.getElementById(`${filterId}Display`);
    if (selectedValues.includes('الكل')) {
        displayElement.textContent = 'الكل';
    } else if (selectedValues.length > 1) {
        displayElement.textContent = `${selectedValues.length} محدد`;
    } else {
        displayElement.textContent = selectedValues[0] || 'الكل';
    }
};

let debounceTimer;
function updateDashboard() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
    const gradeFilterValues = getSelectedFilterValues('gradeFilter');
    const sectionFilterValues = getSelectedFilterValues('sectionFilter');
    const levelFilter = document.getElementById('levelFilter').value; // Single select
    const categoryFilterValues = getSelectedFilterValues('categoryFilter');
    const subjectFilterValues = getSelectedFilterValues('subjectFilter');
    const timeFilterValues = getSelectedFilterValues('timeFilter');

    // For subject filter, if multiple subjects are selected, 'overall' should still be based on the original overall score.
    // If only one subject is selected, 'overall' can be adjusted to that subject's score.
    const selectedSubjectKeyForOverall = (subjectFilterValues.length === 1 && subjectFilterValues[0] !== 'الكل')
        ? subjectKeys.find(key => subjectLabels[key] === subjectFilterValues[0])
        : null;

    const subjectKeyMap = Object.fromEntries(Object.entries(subjectLabels).map(([key, label]) => [label, key]));

    let filteredStudents = allStudentsData.filter(student => {
        let studentOverallForFiltering = student.overall;
        let studentCategoryForFiltering = student.category;

        if (selectedSubjectKeyForOverall) {
            studentOverallForFiltering = student.scores[selectedSubjectKeyForOverall] ?? 0;
            studentCategoryForFiltering = getGradeCategory(studentOverallForFiltering); // Recalculate if subject filter changes overall
        }

        const matchesGrade = gradeFilterValues.includes('الكل') || gradeFilterValues.includes(student.grade ?? '');
        const matchesSection = sectionFilterValues.includes('الكل') || sectionFilterValues.includes(student.section ?? '');
        const matchesTime = timeFilterValues.includes('الكل') || timeFilterValues.includes(student.time ?? '');

        let matchesCategory = categoryFilterValues.includes('الكل') || categoryFilterValues.includes(studentCategoryForFiltering);
        let matchesSubject = subjectFilterValues.includes('الكل');

        if (!subjectFilterValues.includes('الكل')) {
            matchesSubject = subjectFilterValues.some(sf => {
                const key = subjectKeyMap[sf];
                return key && (student.scores[key] ?? 0) > 0;
            });
        }

        if (categoryFilterValues.includes('الغياب')) {
            if (studentOverallForFiltering === 0) {
                matchesCategory = true;
            } else if (categoryFilterValues.length === 1) {
                matchesCategory = false;
            } else {
                matchesCategory = categoryFilterValues.includes(studentCategoryForFiltering);
            }
        } else if (!categoryFilterValues.includes('الكل')) {
            matchesCategory = categoryFilterValues.includes(studentCategoryForFiltering);
        }

        return matchesGrade && matchesSection && matchesCategory && matchesSubject && matchesTime;
    });

    if (levelFilter === 'top10') {
        filteredStudents.sort((a, b) => b.overall - a.overall);
        filteredStudents = filteredStudents.slice(0, 10);
    } else if (levelFilter === 'bottom10') {
        filteredStudents.sort((a, b) => a.overall - b.overall);
        filteredStudents = filteredStudents.slice(0, 10);
    }

    const titleParts = ['كشف الطلاب والدرجات'];
    const filters = {
        gradeFilter: { label: 'الصف', values: gradeFilterValues },
        sectionFilter: { label: 'القسم', values: sectionFilterValues },
        categoryFilter: { label: 'التقدير', values: categoryFilterValues },
        subjectFilter: { label: 'المادة', values: subjectFilterValues },
        timeFilter: { label: 'نوع التحليل', values: timeFilterValues }
    };

    for (const filterId in filters) {
        const filter = filters[filterId];
        if (!filter.values.includes('الكل')) {
            titleParts.push(`${filter.label}: ${filter.values.join(', ')}`);
        }
    }
    if (levelFilter === 'top10') titleParts.push('أعلى عشرة');
    if (levelFilter === 'bottom10') titleParts.push('أدنى عشرة');
    document.getElementById('studentsTableTitle').textContent = titleParts.join(' - ');

    updateStatsCards(filteredStudents);
    updateSubjectAverageChart(filteredStudents);
    updateGradeDistributionChart(filteredStudents);
    updateGradeStudentDistributionChart(filteredStudents); // New chart
    updateAverageGradeByClassChart(filteredStudents); // New chart
    updateStudentsTable(filteredStudents);
    }, 100); // Debounce for 100ms
}

function updateStatsCards(students) {
    document.getElementById('totalStudents').textContent = students.length;

    if (students.length === 0) {
        document.getElementById('averageScore').textContent = '0';
        document.getElementById('topSubject').textContent = '-';
        document.getElementById('bottomSubject').textContent = '-';
        document.getElementById('topClass').textContent = '-';
        document.getElementById('topClassScore').textContent = '';
        document.getElementById('bottomClass').textContent = '-';
        document.getElementById('bottomClassScore').textContent = '';
        return;
    }

    const averageScore = (students.reduce((acc, student) => acc + student.overall, 0) / students.length).toFixed(2);
    document.getElementById('averageScore').textContent = averageScore;

    const subjectAvgs = calculateSubjectAverages(students);
    const sortedSubjects = Object.entries(subjectAvgs).filter(([key, avg]) => key !== 'behavior' && avg > 0).sort(([, a], [, b]) => b - a);

    document.getElementById('topSubject').textContent = sortedSubjects[0]? subjectLabels[sortedSubjects[0][0]] || sortedSubjects[0][0] : '-';
    document.getElementById('bottomSubject').textContent = sortedSubjects[0]? subjectLabels[sortedSubjects[sortedSubjects.length - 1][0]] || sortedSubjects[sortedSubjects.length - 1][0] : '-';

    // Update top and bottom performing student cards
    updateTopBottomStudentsCards(students);
    // Update top and bottom performing class cards
    updateTopBottomClassCards(students);
}

function updateTopBottomClassCards(students) {
    const topClassElement = document.getElementById('topClass');
    const topClassScoreElement = document.getElementById('topClassScore');
    const bottomClassElement = document.getElementById('bottomClass');
    const bottomClassScoreElement = document.getElementById('bottomClassScore');

    if (students.length === 0) {
        topClassElement.textContent = '-';
        topClassScoreElement.textContent = '';
        bottomClassElement.textContent = '-';
        bottomClassScoreElement.textContent = '';
        return;
    }

    const classAverages = {};
    const classCounts = {};

    students.forEach(student => {
        classAverages[student.grade] = (classAverages[student.grade] || 0) + student.overall;
        classCounts[student.grade] = (classCounts[student.grade] || 0) + 1;
    });

    const calculatedClassAverages = Object.entries(classAverages).map(([grade, totalScore]) => ({
        grade: grade,
        average: (totalScore / classCounts[grade]).toFixed(2)
    }));

    calculatedClassAverages.sort((a, b) => b.average - a.average);

    const topClass = calculatedClassAverages[0];
    const bottomClass = calculatedClassAverages[calculatedClassAverages.length - 1];

    topClassElement.textContent = topClass.grade || '-';
    topClassScoreElement.textContent = `متوسط: ${topClass.average}%`;

    bottomClassElement.textContent = bottomClass.grade || '-';
    bottomClassScoreElement.textContent = `متوسط: ${bottomClass.average}%`;
}

function updateTopBottomStudentsCards(students) {
    const topStudentNameElement = document.getElementById('topStudentName');
    const topStudentScoreElement = document.getElementById('topStudentScore');
    const bottomStudentNameElement = document.getElementById('bottomStudentName');
    const bottomStudentScoreElement = document.getElementById('bottomStudentScore');

    if (students.length === 0) {
        topStudentNameElement.textContent = '-';
        topStudentScoreElement.textContent = '';
        bottomStudentNameElement.textContent = '-';
        bottomStudentScoreElement.textContent = '';
        return;
    }

    const sortedByOverall = [...students].sort((a, b) => b.overall - a.overall);
    const topStudent = sortedByOverall[0];
    const bottomStudent = sortedByOverall[sortedByOverall.length - 1];

    topStudentNameElement.textContent = topStudent.name || '-';
    topStudentScoreElement.textContent = `الصف: ${topStudent.grade || '-'} - النسبة: ${topStudent.overall.toFixed(2)}%`;

    bottomStudentNameElement.textContent = bottomStudent.name || '-';
    bottomStudentScoreElement.textContent = `الصف: ${bottomStudent.grade || '-'} - النسبة: ${bottomStudent.overall.toFixed(2)}%`;
}

function calculateSubjectAverages(students) {
    const subjectTotals = {};
    const subjectCounts = {};

    students.forEach(student => {
        for (const subject of subjectKeys) {
            if (student.scores[subject] !== null) {
                subjectTotals[subject] = (subjectTotals[subject] || 0) + student.scores[subject];
                subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
            }
        }
    });

    const subjectAvgs = {};
    for (const subject in subjectTotals) {
        subjectAvgs[subject] = subjectTotals[subject] / subjectCounts[subject];
    }
    return subjectAvgs;
}

function updateChart(chartInstance, ctx, type, data, options, plugins) {
    if (chartInstance) {
        chartInstance.data = data;
        chartInstance.options = options;
        chartInstance.update();
        return chartInstance;
    }
    return new Chart(ctx, { type, data, options, plugins });
}

function updateSubjectAverageChart(students) {
    const ctx = document.getElementById('subjectAverageChart').getContext('2d');
    const subjectFilterValues = getSelectedFilterValues('subjectFilter');
    const subjectAvgs = calculateSubjectAverages(students);
    const subjectKeyMap = Object.fromEntries(Object.entries(subjectLabels).map(([key, label]) => [label, key]));

    let filteredSubjects;
    if (subjectFilterValues.includes('الكل')) {
        filteredSubjects = Object.entries(subjectAvgs).filter(([key, avg]) => avg > 0 && key !== 'behavior');
    } else {
        filteredSubjects = subjectFilterValues
            .map(label => {
                const key = subjectKeyMap[label];
                return key && subjectAvgs[key] > 0 ? [key, subjectAvgs[key]] : null;
            })
            .filter(Boolean); // Remove nulls for subjects not found or with 0 average
    }

    const labels = filteredSubjects.map(([key]) => subjectLabels[key] || key);
    const data = filteredSubjects.map(([, avg]) => avg);
    const backgroundColors = labels.map((_, i) => dynamicSubjectColors[i % dynamicSubjectColors.length]);

    subjectAverageChart = updateChart(subjectAverageChart, ctx, 'bar', {
        labels: labels,
        datasets: [{
            label: 'متوسط الدرجات',
            data: data,
            backgroundColor: backgroundColors,
            borderColor: backgroundColors,
            borderWidth: 2
        }]
    }, {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, max: 100, grid: { color: '#e2e8f0' }, ticks: { font: { family: "'Cairo', sans-serif" } } },
            x: { grid: { color: '#f1f5f9' }, ticks: { font: { family: "'Cairo', sans-serif" }, color: '#0f766e' } }
        },
        plugins: {
            legend: { display: false },
            tooltip: { bodyFont: { family: "'Cairo', sans-serif" }, titleFont: { family: "'Cairo', sans-serif" } },
            title: {
                display: labels.length === 0,
                text: labels.length === 0 ? 'لا توجد مواد لها درجات لعرضها' : '',
                color: '#ef4444',
                font: { family: "'Cairo', sans-serif", size: 14 }
            },
            datalabels: {
                display: true, // Explicitly enable datalabels
                anchor: 'end', // Changed back to 'end' for top positioning
                align: 'center',
                color: '#000',
                font: { family: "'Cairo', sans-serif", weight: 'bold', size: 13 },
                formatter: (value) => value.toFixed(1) + '%'
            }
        },
        onClick: (evt, elements) => {
            if (elements.length > 0) {
                const idx = elements[0].index;
                alert(`تفاصيل المادة: ${labels[idx]}\nمتوسط الدرجة: ${data[idx].toFixed(2)}`);
            }
        }
    }, [window.ChartDataLabels]);
}

function updateGradeDistributionChart(students) {
    const ctx = document.getElementById('gradeDistributionChart').getContext('2d');
    const gradeCounts = { 'ممتاز': 0, 'جيد جداً': 0, 'جيد': 0, 'مقبول': 0, 'ضعيف': 0, 'الغياب': 0 };

    students.forEach(student => gradeCounts[getGradeCategory(student.overall)]++);
    const total = Object.values(gradeCounts).reduce((a, b) => a + b, 0);

    gradeDistributionChart = updateChart(gradeDistributionChart, ctx, 'doughnut', {
        labels: Object.keys(gradeCounts),
        datasets: [{ data: Object.values(gradeCounts), backgroundColor: chartColors.grades }]
    }, {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { font: { family: "'Cairo', sans-serif" } } },
            tooltip: {
                bodyFont: { family: "'Cairo', sans-serif" },
                titleFont: { family: "'Cairo', sans-serif" },
                callbacks: {
                    label: (context) => {
                        const data = context.chart.data.datasets[0].data;
                        const totalInCallback = data.reduce((a, b) => a + b, 0);
                        const value = context.parsed;
                        const percent = totalInCallback > 0 ? ((value / totalInCallback) * 100).toFixed(1) : 0;
                        return `${value} طالب (${percent}%)`;
                    }
                }
            },
            datalabels: {
                display: false // Disable datalabels on the chart
            },
            legend: {
                position: 'right', // Position legend to the right for a side table effect
                labels: {
                    font: { family: "'Cairo', sans-serif" },
                    generateLabels: (chart) => {
                        const data = chart.data.datasets[0].data;
                        const labels = chart.data.labels;
                        const backgroundColors = chart.data.datasets[0].backgroundColor;
                        const totalInCallback = data.reduce((a, b) => a + b, 0);

                        return labels.map((label, i) => {
                            const value = data[i];
                            const percentage = totalInCallback > 0 ? ((value / totalInCallback) * 100).toFixed(1) : 0;
                            return {
                                text: `${label}: ${value} (${percentage}%)`, // Show label, count, and percentage
                                fillStyle: backgroundColors[i],
                                strokeStyle: backgroundColors[i],
                                lineWidth: 1,
                                hidden: isNaN(value) || value === 0, // Hide if no data
                                index: i
                            };
                        });
                    }
                }
            }
        }
    }, [window.ChartDataLabels]);

    if (total === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "16px 'Cairo', sans-serif";
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText('لا يوجد طلاب لعرض توزيع التقديرات', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
}

function updateGradeStudentDistributionChart(students) {
    const ctx = document.getElementById('gradeStudentDistributionChart').getContext('2d');
    const gradeCounts = {};
    students.forEach(student => {
        gradeCounts[student.grade] = (gradeCounts[student.grade] || 0) + 1;
    });

    const labels = Object.keys(gradeCounts).sort();
    const data = labels.map(grade => gradeCounts[grade]);
    const total = data.reduce((a, b) => a + b, 0); // Define total here

    const backgroundColors = [
        '#4CAF50', '#2196F3', '#FFC107', '#FF5722', '#9C27B0', '#00BCD4', '#8BC34A', '#FFEB3B', '#E91E63', '#607D8B'
    ];

    gradeStudentDistributionChart = updateChart(gradeStudentDistributionChart, ctx, 'doughnut', {
        labels: labels,
        datasets: [{
            data: data,
            backgroundColor: backgroundColors.slice(0, labels.length)
        }]
    }, {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { font: { family: "'Cairo', sans-serif" } } },
            tooltip: {
                bodyFont: { family: "'Cairo', sans-serif" },
                titleFont: { family: "'Cairo', sans-serif" },
                callbacks: {
                    label: (context) => {
                        const data = context.chart.data.datasets[0].data;
                        const totalInCallback = data.reduce((a, b) => a + b, 0);
                        const value = context.parsed;
                        const percent = totalInCallback > 0 ? ((value / totalInCallback) * 100).toFixed(1) : 0;
                        return `${value} طالب (${percent}%)`;
                    }
                }
            },
            datalabels: {
                display: false // Disable datalabels on the chart
            },
            legend: {
                position: 'right', // Position legend to the right for a side table effect
                labels: {
                    font: { family: "'Cairo', sans-serif" },
                    generateLabels: (chart) => {
                        const data = chart.data.datasets[0].data;
                        const labels = chart.data.labels;
                        const backgroundColors = chart.data.datasets[0].backgroundColor;
                        const totalInCallback = data.reduce((a, b) => a + b, 0);

                        return labels.map((label, i) => {
                            const value = data[i];
                            const percentage = totalInCallback > 0 ? ((value / totalInCallback) * 100).toFixed(1) : 0;
                            return {
                                text: `${label}: ${value} (${percentage}%)`, // Show label, count, and percentage
                                fillStyle: backgroundColors[i],
                                strokeStyle: backgroundColors[i],
                                lineWidth: 1,
                                hidden: isNaN(value) || value === 0, // Hide if no data
                                index: i
                            };
                        });
                    }
                }
            }
        }
    }, [window.ChartDataLabels]);

    if (total === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "16px 'Cairo', sans-serif";
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText('لا يوجد طلاب لعرض توزيع الصفوف', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
}

function updateAverageGradeByClassChart(students) {
    const ctx = document.getElementById('averageGradeByClassChart').getContext('2d');
    const gradeAverages = {};
    const gradeCounts = {};

    students.forEach(student => {
        gradeAverages[student.grade] = (gradeAverages[student.grade] || 0) + student.overall;
        gradeCounts[student.grade] = (gradeCounts[student.grade] || 0) + 1;
    });

    const labels = Object.keys(gradeAverages).sort();
    const data = labels.map(grade => (gradeAverages[grade] / gradeCounts[grade]).toFixed(2));
    const total = data.reduce((a, b) => a + b, 0); // Define total here

    averageGradeByClassChart = updateChart(averageGradeByClassChart, ctx, 'bar', {
        labels: labels,
        datasets: [{
            label: 'متوسط الدرجة',
            data: data,
            backgroundColor: labels.map((_, i) => dynamicSubjectColors[i % dynamicSubjectColors.length]),
            borderColor: labels.map((_, i) => dynamicSubjectColors[i % dynamicSubjectColors.length]),
            borderWidth: 1
        }]
    }, {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, max: 100, grid: { color: '#e2e8f0' }, ticks: { font: { family: "'Cairo', sans-serif" } } },
            x: { grid: { color: '#f1f5f9' }, ticks: { font: { family: "'Cairo', sans-serif" }, color: '#0f766e' } }
        },
        plugins: {
            legend: { display: false },
            tooltip: { bodyFont: { family: "'Cairo', sans-serif" }, titleFont: { family: "'Cairo', sans-serif" } },
            title: {
                display: labels.length === 0,
                text: labels.length === 0 ? 'لا توجد بيانات لعرض متوسط الدرجات حسب الصف' : '',
                color: '#ef4444',
                font: { family: "'Cairo', sans-serif", size: 14 }
            },
            datalabels: {
                display: true, // Explicitly enable datalabels
                anchor: 'end', // Changed back to 'end' for top positioning
                align: 'center',
                color: '#000',
                font: { family: "'Cairo', sans-serif", weight: 'bold', size: 13 },
                formatter: (value) => value + '%'
            }
        }
    }, [window.ChartDataLabels]);

    if (total === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "16px 'Cairo', sans-serif";
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText('لا توجد بيانات لعرض متوسط الدرجات حسب الصف', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
}

function updateStudentsTable(students) {
    const tableBody = document.getElementById('studentsTableBody');
    const subjectFilterValues = getSelectedFilterValues('subjectFilter');
    const subjectKeyMap = Object.fromEntries(Object.entries(subjectLabels).map(([key, label]) => [label, key]));

    // Determine which subject columns to show
    let columnsToShow;
    if (subjectFilterValues.includes('الكل')) {
        // Show all subjects that are not completely empty across all students
        columnsToShow = subjectKeys.filter(key => 
            key !== 'time' && 
            !students.every(student => (student.scores[key] ?? null) === null || student.scores[key] === 0)
        );
    } else {
        // Show only selected subjects that have actual data (not all zeros) among the filtered students
        const selectedSubjectKeys = subjectFilterValues.map(label => subjectKeyMap[label]).filter(Boolean);
        columnsToShow = selectedSubjectKeys.filter(key => 
            students.some(student => (student.scores[key] ?? 0) > 0)
        );
    }

    // The time column is no longer displayed in the table, but its filter remains functional.
    const hidePercentageColumn = subjectFilterValues.length > 0 && !subjectFilterValues.includes('الكل');
    
    updateTableHeader(columnsToShow, hidePercentageColumn);

    if (students.length === 0) {
        const columnCount = document.querySelector('table thead th')?.parentElement.childElementCount || 10;
        tableBody.innerHTML = `<tr><td colspan="${columnCount}" class="text-center py-4">لا توجد بيانات تطابق خيارات التصفية.</td></tr>`;
        return;
    }

    const sortedStudents = students.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)); // Sort by adjusted overall score
    
    // Clear existing rows efficiently
    while (tableBody.firstChild) {
        tableBody.removeChild(tableBody.firstChild);
    }

    const fragment = document.createDocumentFragment();

    sortedStudents.forEach((student, idx) => {
        const row = document.createElement('tr');
        row.className = "bg-white border-b hover:bg-slate-50";

        const cells = [
            `<td class="px-2 py-2 font-bold">${idx + 1}</td>`,
            `<td class="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">${student.name}</td>`,
            `<td class="px-2 py-2">${student.grade}</td>`,
            `<td class="px-2 py-2">${student.section}</td>`,
            ...columnsToShow.map(key => `<td class="px-1 py-2">${student.scores[key] ?? '-'}</td>`)
        ];

        if (!hidePercentageColumn) {
            cells.push(`<td class="px-2 py-2 font-bold">${student.percent ?? '-'}</td>`);
        }
        cells.push(`<td class="px-2 py-2 font-bold">${student.category}</td>`); // Use pre-calculated category

        row.innerHTML = cells.join('');
        fragment.appendChild(row);
    });
    tableBody.appendChild(fragment);
}

function updateTableHeader(columnsToShow, hidePercentageColumn) {
    const thead = document.querySelector('table thead tr');
    if (!thead) return;

    const baseHeaders = ['الترتيب', 'اسم الطالب', 'الصف', 'القسم'];
    const dynamicSubjectHeaders = columnsToShow.map(key => subjectLabels[key]);
    const endHeaders = ['التقدير'];
    if (!hidePercentageColumn) {
        endHeaders.unshift('النسبة');
    }
    
    let allHeaders = [...baseHeaders, ...dynamicSubjectHeaders, ...endHeaders];

    thead.innerHTML = `
        <tr>
            ${allHeaders.map(header => `<th scope="col" class="px-2 py-2 whitespace-nowrap">${header}</th>`).join('')}
        </tr>
    `;
}
//Kamal
function exportTableAsExcel() {
    const table = document.querySelector('table');
    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نتائج التحليل");
    XLSX.writeFile(wb, "نتائج_التحليل.xlsx");
}

// Helper function to initialize and manage multi-select dropdowns
const initializeMultiSelectDropdown = (id, staticOptions = null) => {
    const toggleButton = document.getElementById(`${id}Toggle`);
    const dropdown = document.getElementById(`${id}Dropdown`);
    const dropdownContent = dropdown.querySelector('.p-2');

    const populateOptions = (values) => {
        dropdownContent.innerHTML = `
            <label class="flex items-center px-2 py-1 hover:bg-slate-100 rounded-md cursor-pointer">
                <input type="checkbox" value="الكل" class="form-checkbox h-4 w-4 text-teal-600 rounded focus:ring-teal-500" checked>
                <span class="mr-2 text-sm text-slate-700">الكل</span>
            </label>
        `;
        values.forEach(val => {
            dropdownContent.innerHTML += `
                <label class="flex items-center px-2 py-1 hover:bg-slate-100 rounded-md cursor-pointer">
                    <input type="checkbox" value="${val}" class="form-checkbox h-4 w-4 text-teal-600 rounded focus:ring-teal-500">
                    <span class="mr-2 text-sm text-slate-700">${val}</span>
                </label>
            `;
        });
        updateFilterDisplay(id, ['الكل']);
    };

    const reset = () => {
        const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = (cb.value === 'الكل'));
        updateFilterDisplay(id, ['الكل']);
    };

    // Initial population for static categories
    if (id === 'categoryFilter') {
        populateOptions(['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'ضعيف', 'الغياب']);
    } else if (staticOptions) {
        populateOptions(staticOptions);
    }

    toggleButton.addEventListener('click', (event) => {
        event.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    dropdown.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox') {
            const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
            if (event.target.value === 'الكل') {
                checkboxes.forEach(cb => {
                    if (cb !== event.target) cb.checked = false;
                });
            } else {
                const allCheckbox = dropdown.querySelector('input[value="الكل"]');
                if (allCheckbox) allCheckbox.checked = false;
            }
            if (!Array.from(checkboxes).some(cb => cb.checked)) {
                const allCheckbox = dropdown.querySelector('input[value="الكل"]');
                if (allCheckbox) allCheckbox.checked = true;
            }
            updateFilterDisplay(id, getSelectedFilterValues(id));
            updateDashboard();
        }
    });

    return { populateOptions, reset, dropdown }; // Return populateOptions, reset, and dropdown element
};

let gradeFilterDropdown, sectionFilterDropdown, categoryFilterDropdown, subjectFilterDropdown, timeFilterDropdown;

function setupEventListeners() {
    document.getElementById('levelFilter').addEventListener('change', updateDashboard);

    gradeFilterDropdown = initializeMultiSelectDropdown('gradeFilter');
    sectionFilterDropdown = initializeMultiSelectDropdown('sectionFilter');
    categoryFilterDropdown = initializeMultiSelectDropdown('categoryFilter');
    subjectFilterDropdown = initializeMultiSelectDropdown('subjectFilter');
    timeFilterDropdown = initializeMultiSelectDropdown('timeFilter');

    document.addEventListener('click', (event) => {
        ['gradeFilter', 'sectionFilter', 'categoryFilter', 'subjectFilter', 'timeFilter'].forEach(id => {
            const dropdown = document.getElementById(`${id}Dropdown`);
            const toggleButton = document.getElementById(`${id}Toggle`);
            if (dropdown && toggleButton && !dropdown.contains(event.target) && !toggleButton.contains(event.target)) {
                dropdown.classList.add('hidden');
            }
        });
    });

    document.getElementById('downloadExcelBtn').addEventListener('click', exportTableAsExcel);
    document.getElementById('exportSubjectChartBtn').addEventListener('click', () => exportChart('subjectAverageChart', 'subject_average_chart.png'));
    document.getElementById('exportGradeChartBtn').addEventListener('click', () => exportChart('gradeDistributionChart', 'grade_distribution_chart.png'));
    document.getElementById('exportGradeStudentDistributionChartBtn').addEventListener('click', () => exportChart('gradeStudentDistributionChart', 'grade_student_distribution_chart.png')); // New export button
    document.getElementById('exportAverageGradeByClassChartBtn').addEventListener('click', () => exportChart('averageGradeByClassChart', 'average_grade_by_class_chart.png')); // New export button

    const csvUpload = document.getElementById('csvUpload');
    const csvTooltip = document.getElementById('csvTooltip');
    ['focus', 'mouseover'].forEach(event => csvUpload.addEventListener(event, () => csvTooltip.classList.add('tooltip-visible')));
    ['blur', 'mouseout'].forEach(event => csvUpload.addEventListener(event, () => csvTooltip.classList.remove('tooltip-visible')));
    csvUpload.addEventListener('change', handleCsvUpload);

    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
}

function resetFilters() {
    document.getElementById('levelFilter').value = 'الكل';

    const multiSelectFilterInstances = [gradeFilterDropdown, sectionFilterDropdown, categoryFilterDropdown, subjectFilterDropdown, timeFilterDropdown];
    multiSelectFilterInstances.forEach(instance => {
        instance.reset();
    });
    updateDashboard();
}

const exportChart = (chartId, filename) => {
    const link = Object.assign(document.createElement('a'), {
        href: document.getElementById(chartId).toDataURL('image/png'),
        download: filename
    });
    link.click();
};

const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    const statusMsg = document.getElementById('csvStatusMsg');
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
        displayStatusMessage(statusMsg, 'الملف يجب أن يكون بصيغة CSV.', 'rose');
        return;
    }

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            try {
                const fileHeaders = results.meta.fields || [];
                const fixedHeaders = ['اسم الطالب', 'الصف', 'القسم', 'سلوك', 'النسبة', 'نوع التحليل'];
                
                subjectLabels = {};
                subjectKeys = [];
                fileHeaders.forEach(header => {
                    if (!fixedHeaders.includes(header)) {
                        const key = header.replace(/\s/g, '').toLowerCase();
                        subjectLabels[key] = header;
                        subjectKeys.push(key);
                    }
                });

                allStudentsData = results.data.map(row => {
                    const scores = {};
                    subjectKeys.forEach(key => {
                        scores[key] = Number(row[subjectLabels[key]]) || 0;
                    });
                    scores['behavior'] = Number(row['سلوك']) || 0;

                    const overallScore = Number(row['النسبة']) || 0;
                    return {
                        name: row['اسم الطالب'],
                        grade: row['الصف'],
                        section: row['القسم'],
                        scores: scores,
                        percent: overallScore,
                        overall: overallScore,
                        time: row['نوع التحليل'] || null,
                        category: getGradeCategory(overallScore) // Pre-calculate category
                    };
                });
                dynamicSubjectColors = generateColors(subjectKeys.length); // Generate colors based on the number of subjects
                updateFilterOptions();
                updateDashboard();
                displayStatusMessage(statusMsg, 'تم رفع الملف بنجاح!', 'teal');
            } catch (err) {
                console.error(err);
                displayStatusMessage(statusMsg, 'حدث خطأ أثناء معالجة الملف.', 'rose');
            }
        },
        error: () => displayStatusMessage(statusMsg, 'تعذر قراءة الملف. تأكد من الصيغة.', 'rose')
    });
};

const displayStatusMessage = (element, message, type, duration = 4000) => {
    element.textContent = message;
    element.style.display = 'block';
    element.className = `mt-2 w-full text-center text-sm rounded-lg py-2 bg-${type}-100 text-${type}-700 border border-${type}-300 transition-all duration-300`;
    setTimeout(() => { element.style.display = 'none'; }, duration);
};

function updateFilterOptions() {
    gradeFilterDropdown.populateOptions([...new Set(allStudentsData.map(s => s.grade).filter(Boolean))].sort());
    sectionFilterDropdown.populateOptions([...new Set(allStudentsData.map(s => s.section).filter(Boolean))].sort());
    timeFilterDropdown.populateOptions([...new Set(allStudentsData.map(s => s.time).filter(Boolean))].sort());
    subjectFilterDropdown.populateOptions(Object.values(subjectLabels).filter(label => label !== 'الغياب').sort());
    // categoryFilter is static, no need to populate dynamically
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateDashboard();

    document.getElementById('helpBtn').addEventListener('click', () => {
        document.getElementById('helpModal').classList.remove('hidden');
    });

    document.getElementById('closeHelp').addEventListener('click', () => {
        document.getElementById('helpModal').classList.add('hidden');
    });
});
