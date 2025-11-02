let subjectAverageChart, gradeDistributionChart, gradeStudentDistributionChart, averageGradeByClassChart,
    overallPerformanceComparisonChart, subjectPerformancePerMonthChart, classPerformancePerMonthChart;
let allStudentsData = [];
let amiriFont = null; // To hold the base64 font
let amiriBoldFont = null; // To hold the bold font
let analysisHasRun = false; // لتتبع ما إذا كان التحليل قد تم
let shouldShowTimeColumn = false; // New global variable to control visibility of 'نوع التحليل' column

let subjectLabels = {}; // Maps key to clean name, e.g., { 'math': 'الرياضيات' }
let subjectKeys = [];   // e.g., ['math', 'science']
let globalMaxScore = 100; // Will be set by the user
//الحمد لله وسبحان الله ولا إله إلا الله والله أكبر 
const getScoreAsPercentage = (score) => {
    if (globalMaxScore === 0) return 0;
    return (score / globalMaxScore) * 100;
};
// التعديل رقم 740
const getGradeCategory = (percentage) => {
    if (percentage === 0) return 'الغياب';
    if (percentage >= 90) return 'ممتاز';
    if (percentage >= 80) return 'جيد جداً';
    if (percentage >= 65) return 'جيد';
    if (percentage >= 50) return 'مقبول';
    return 'ضعيف';
};

const formatPercentage = (value) => {
    if (value == null || isNaN(value)) {
        return '-';
    }
    // Format to a maximum of two decimal places, only if needed.
    const formattedValue = parseFloat(value.toFixed(2));
    return `%${formattedValue}`;
};

const getCategoryColorClass = (category) => {
    switch (category) {
        case 'ممتاز':
            return 'bg-green-100 text-green-800';
        case 'جيد جداً':
            return 'bg-blue-100 text-blue-800';
        case 'جيد':
            return 'bg-amber-100 text-amber-800';
        case 'مقبول':
            return 'bg-purple-100 text-purple-800';
        case 'ضعيف':
            return 'bg-red-100 text-red-800';
        case 'الغياب':
            return 'bg-slate-200 text-slate-800';
        default:
            return 'text-slate-700'; // افتراضي
    }
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

let labelColorMap = {}; // Global map to store consistent colors for labels (for hex colors)
let colorIndex = 0; // To cycle through predefined colors (for hex colors)
const predefinedColors = [
    '#0d9488', // teal-600
    '#2563eb', // blue-600
    '#fbbf24', // amber-400
    '#a78bfa', // purple-400
    '#ef4444', // red-500
    '#10b981', // emerald-500
    '#6366f1', // indigo-500
    '#f97316', // orange-500
    '#84cc16', // lime-500
    '#ec4899', // pink-500
    '#64748b', // slate-500
    '#06b6d4', // cyan-500
    '#f43f5e', // rose-500
    '#eab308', // yellow-500
    '#3b82f6', // blue-500
    '#a855f7', // violet-500
    '#f59e0b', // amber-500
    '#22c55e', // green-500
    '#d946ef', // fuchsia-500
    '#8b5cf6'  // violet-500
];

const getConsistentColor = (label) => {
    if (!labelColorMap[label]) {
        labelColorMap[label] = predefinedColors[colorIndex % predefinedColors.length];
        colorIndex++;
    }
    return labelColorMap[label];
};


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

let currentPercentageFilter = null; // Global variable to store the percentage for filtering
let debounceTimer;
function updateDashboard(onCompleteCallback = null) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
    const sectionFilterValues = getSelectedFilterValues('sectionFilter'); // القسم
    const gradeFilterValues = getSelectedFilterValues('gradeFilter'); // الصف الدراسي
    const divisionFilterValues = getSelectedFilterValues('divisionFilter'); // الشعبة - NEW
    const subjectFilterValues = getSelectedFilterValues('subjectFilter'); // المادة الدراسية
    const categoryFilterValues = getSelectedFilterValues('categoryFilter'); // فئة التقدير
    const levelFilter = document.getElementById('levelFilter').value; // المستوى - Single select
    const timeFilterValues = getSelectedFilterValues('timeFilter'); // نوع التحليل
    const searchQuery = document.getElementById('studentSearchInput').value.trim().toLowerCase();

    // If 'greaterThan' or 'lessThan' is selected, but no percentage is set,
    // or if the filter is changed away from these options, reset the percentage.
    if ((levelFilter === 'greaterThan' || levelFilter === 'lessThan') && currentPercentageFilter === null) {
        // Do nothing, wait for the modal to set currentPercentageFilter
    } else if (levelFilter !== 'greaterThan' && levelFilter !== 'lessThan') {
        currentPercentageFilter = null; // Reset if filter is not 'greaterThan' or 'lessThan'
    }

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
            const rawScore = student.scores[selectedSubjectKeyForOverall] ?? 0;
            studentOverallForFiltering = getScoreAsPercentage(rawScore);
            studentCategoryForFiltering = getGradeCategory(studentOverallForFiltering);
        }

        const matchesSection = sectionFilterValues.includes('الكل') || sectionFilterValues.includes(student.section ?? '');
        const matchesGrade = gradeFilterValues.includes('الكل') || gradeFilterValues.includes(student.grade ?? '');
        const matchesDivision = divisionFilterValues.includes('الكل') || divisionFilterValues.includes(student.division ?? ''); // NEW
        const matchesTime = timeFilterValues.includes('الكل') || timeFilterValues.includes(student.time ?? '');

        // Simplified category matching logic
        const matchesCategory = (() => {
            if (categoryFilterValues.includes('الكل')) return true;
            const isAbsent = studentOverallForFiltering === 0;
            const matchesAbsent = categoryFilterValues.includes('الغياب') && isAbsent;
            const matchesRegularCategory = categoryFilterValues.includes(studentCategoryForFiltering) && !isAbsent;
            return matchesAbsent || matchesRegularCategory;
        })();

        let matchesSubject = subjectFilterValues.includes('الكل');

        if (!subjectFilterValues.includes('الكل')) {
            // If filtering for 'Absent' and a single subject is chosen, the logic must find students with a score of 0.
            if (categoryFilterValues.includes('الغياب') && selectedSubjectKeyForOverall) {
                // The category match already confirmed absence based on this subject's score.
                // So, we just need to confirm the match.
                matchesSubject = true;
            } else {
                // Original logic: check if student has a score > 0 in any of the selected subjects.
                matchesSubject = subjectFilterValues.some(sf => {
                    const key = subjectKeyMap[sf];
                    return key && (student.scores[key] ?? 0) > 0;
                });
            }
        }

        const matchesSearch = !searchQuery || (student.name && student.name.toLowerCase().includes(searchQuery));

        // New filtering for 'greaterThan' and 'lessThan'
        let matchesLevel = true;
        if (levelFilter === 'greaterThan' && currentPercentageFilter !== null) {
            matchesLevel = studentOverallForFiltering > currentPercentageFilter;
        } else if (levelFilter === 'lessThan' && currentPercentageFilter !== null) {
            matchesLevel = studentOverallForFiltering < currentPercentageFilter;
        }

        return matchesSection && matchesGrade && matchesDivision && matchesCategory && matchesSubject && matchesTime && matchesSearch && matchesLevel; // Added matchesDivision and matchesLevel
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
        sectionFilter: { label: 'القسم', values: sectionFilterValues },
        gradeFilter: { label: 'الصف', values: gradeFilterValues },
        divisionFilter: { label: 'الشعبة', values: divisionFilterValues }, // NEW
        subjectFilter: { label: 'المادة', values: subjectFilterValues },
        categoryFilter: { label: 'التقدير', values: categoryFilterValues },
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
    if (levelFilter === 'greaterThan' && currentPercentageFilter !== null) titleParts.push(`أعلى من ${currentPercentageFilter}%`);
    if (levelFilter === 'lessThan' && currentPercentageFilter !== null) titleParts.push(`أدنى من ${currentPercentageFilter}%`);
    document.getElementById('studentsTableTitle').textContent = titleParts.join(' - ');

    updateStatsCards(filteredStudents);
    updateSubjectAverageChart(filteredStudents);
    updateGradeDistributionChart(filteredStudents);
    updateGradeStudentDistributionChart(filteredStudents); // New chart
    updateAverageGradeByClassChart(filteredStudents); // New chart

    // New comparative charts
    const comparativeChartsSection = document.getElementById('comparativeChartsSection');
    let shouldShowComparativeCharts = false;

    if (filteredStudents.length > 0) {
        const distinctTimeValuesInFilteredData = [...new Set(filteredStudents.map(s => s.time).filter(Boolean))];

        if (timeFilterValues.includes('الكل')) {
            shouldShowComparativeCharts = distinctTimeValuesInFilteredData.length > 0; // Show if any time data exists when 'All' is selected
        } else {
            shouldShowComparativeCharts = timeFilterValues.length > 1;
        }
    }

    if (shouldShowComparativeCharts) {
        comparativeChartsSection.classList.remove('hidden');
        updateOverallPerformanceComparisonChart(filteredStudents, timeFilterValues);
        updateSubjectPerformancePerMonthChart(filteredStudents, timeFilterValues);
        updateClassPerformancePerMonthChart(filteredStudents, timeFilterValues);
    } else {
        comparativeChartsSection.classList.add('hidden');
        // Destroy charts if they exist to free up memory
        if (overallPerformanceComparisonChart) { overallPerformanceComparisonChart.destroy(); overallPerformanceComparisonChart = null; }
        if (subjectPerformancePerMonthChart) { subjectPerformancePerMonthChart.destroy(); subjectPerformancePerMonthChart = null; }
        if (classPerformancePerMonthChart) { classPerformancePerMonthChart.destroy(); classPerformancePerMonthChart = null; }
    }

    updateStudentsTable(filteredStudents);

    if (onCompleteCallback) {
        onCompleteCallback();
    }
    }, 100); // Debounce for 100ms
}

const animateCounter = (elementId, finalValue, duration = 1500, isPercentage = false) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Parse the starting value, removing any non-numeric characters like '%'
    let startValue = parseFloat(element.textContent.replace(/[^0-9.-]+/g, "")) || 0;
    
    // If the new value is the same as the old, no need to animate
    if (startValue === finalValue) {
        if (isPercentage) {
            element.textContent = formatPercentage(finalValue);
        } else {
            element.textContent = Math.round(finalValue);
        }
        return;
    }

    let startTime = null;

    const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const currentValue = startValue + (finalValue - startValue) * progress;

        if (isPercentage) {
            element.textContent = formatPercentage(currentValue);
        } else {
            element.textContent = Math.floor(currentValue);
        }

        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
};

function updateStatsCards(students) {
    animateCounter('totalStudents', students.length);

    // Calculate counts for new cards
    let successCount = 0;
    let failureCount = 0;
    let absenceCount = 0;

    students.forEach(student => {
        const category = student.category;
        if (['ممتاز', 'جيد جداً', 'جيد', 'مقبول'].includes(category)) {
            successCount++;
        } else if (category === 'ضعيف') {
            failureCount++;
        } else if (category === 'الغياب') {
            absenceCount++;
        }
    });
    animateCounter('successCount', successCount);
    animateCounter('failureCount', failureCount);
    animateCounter('absenceCount', absenceCount);

    const averageScoreValue = students.length > 0 ? (students.reduce((acc, student) => acc + student.overall, 0) / students.length) : 0;
    animateCounter('averageScore', averageScoreValue, 1500, true);

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
        average: (totalScore / classCounts[grade])
    }));

    calculatedClassAverages.sort((a, b) => b.average - a.average);

    const topClass = calculatedClassAverages[0];
    const bottomClass = calculatedClassAverages[calculatedClassAverages.length - 1];

    topClassElement.textContent = topClass?.grade || '-';
    topClassScoreElement.textContent = topClass ? `متوسط: ${formatPercentage(topClass.average)}` : '';

    bottomClassElement.textContent = bottomClass?.grade || '-';
    bottomClassScoreElement.textContent = bottomClass ? `متوسط: ${formatPercentage(bottomClass.average)}` : '';
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

    topStudentNameElement.textContent = topStudent?.name || '-';
    topStudentScoreElement.textContent = topStudent ? `الصف: ${topStudent.grade || '-'} - النسبة: ${formatPercentage(topStudent.overall)}` : '';

    bottomStudentNameElement.textContent = bottomStudent?.name || '-';
    bottomStudentScoreElement.textContent = bottomStudent ? `الصف: ${bottomStudent.grade || '-'} - النسبة: ${formatPercentage(bottomStudent.overall)}` : '';
}

function calculateSubjectAverages(students) {
    const subjectTotals = {};
    const subjectCounts = {};

    students.forEach(student => {
        // Use Object.keys(student.scores) to only average subjects the student actually has
        for (const subject in student.scores) {
            if (subject !== 'behavior' && student.scores[subject] != null) {
                subjectTotals[subject] = (subjectTotals[subject] || 0) + student.scores[subject];
                subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
            }
        }
    });

    const subjectAvgs = {};
    for (const subject in subjectTotals) {
        const rawAverage = subjectTotals[subject] / subjectCounts[subject];
        subjectAvgs[subject] = getScoreAsPercentage(rawAverage); // Convert average to percentage
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

    let filteredSubjects = [];
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

    // Sort subjects by average score in descending order
    filteredSubjects.sort((a, b) => b[1] - a[1]);

    const labels = filteredSubjects.map(([key]) => subjectLabels[key] || key);
    const data = filteredSubjects.map(([, avg]) => avg);
    const backgroundColors = labels.map(label => getConsistentColor(label));

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
                formatter: (value) => formatPercentage(value)
            }
        },
        onClick: (evt, elements) => {
            if (elements.length > 0) {
                const idx = elements[0].index;
                alert(`تفاصيل المادة: ${labels[idx]}\nمتوسط النسبة: ${formatPercentage(data[idx])}`);
            }
        }
    }, [window.ChartDataLabels]);
}

function updateGradeDistributionChart(students) {
    const ctx = document.getElementById('gradeDistributionChart').getContext('2d');
    const chartContainer = document.querySelector('#gradeDistributionChart').closest('.bg-white');
    const h2 = chartContainer.querySelector('h2');
    const p = chartContainer.querySelector('p');
    let chartData, chartOptions, total;

    if (students.length === 1) {
        // Special mode: Group subjects by category for a single student
        const student = students[0];
        h2.textContent = `توزيع تقديرات مواد الطالب: ${student.name}`;
        p.textContent = `يقسم هذا المخطط مواد الطالب حسب التقدير. مرر الفأرة على أي قسم لرؤية أسماء المواد.`;

        const subjectsByCategory = { 'ممتاز': [], 'جيد جداً': [], 'جيد': [], 'مقبول': [], 'ضعيف': [], 'الغياب': [] };

        Object.keys(student.scores).forEach(key => {
            if (key !== 'behavior') {
                const rawScore = student.scores[key] ?? 0;
                const percentage = getScoreAsPercentage(rawScore);
                const category = getGradeCategory(percentage);
                const subjectName = subjectLabels[key] || key;
                // Only add if the subject has a score > 0, unless the category is 'الغياب'
                if (rawScore > 0 || category === 'الغياب') {
                    subjectsByCategory[category].push(subjectName);
                }
            }
        });

        const labels = Object.keys(subjectsByCategory);
        const data = labels.map(cat => subjectsByCategory[cat].length);
        const backgroundColors = chartColors.grades; // Use predefined category colors
        total = data.reduce((a, b) => a + b, 0);

        chartData = {
            labels: labels,
            datasets: [{ data: data, backgroundColor: backgroundColors }]
        };
        chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    titleFont: { family: "'Cairo', sans-serif" },
                    bodyFont: { family: "'Cairo', sans-serif" },
                    callbacks: {
                        title: (context) => context[0].label,
                        afterBody: (context) => {
                            // Show subject names in the tooltip
                            const category = context[0].label;
                            const subjectList = subjectsByCategory[category];
                            return subjectList.length > 0 ? [''].concat(subjectList) : [];
                        }
                    }
                },
                datalabels: { display: false },
                legend: {
                    position: 'right',
                    labels: {
                        font: { family: "'Cairo', sans-serif" },
                        generateLabels: (chart) => { // Corrected generateLabels
                            const data = chart.data.datasets[0].data;
                            return chart.data.labels.map((label, i) => {
                                const value = data[i];
                                return {
                                    text: `${label}: ${value} مواد`,
                                    fillStyle: chart.data.datasets[0].backgroundColor[i],
                                    strokeStyle: chart.data.datasets[0].backgroundColor[i],
                                    lineWidth: 1,
                                    hidden: isNaN(value) || value === 0,
                                    index: i
                                };
                            });
                        }
                    }
                }
            }
        };
    } else {
        // Default mode: Show overall grade distribution for multiple students
        h2.textContent = 'توزيع التقديرات';
        p.textContent = 'يوضح هذا الرسم نسبة الطلاب ضمن كل فئة من فئات التقدير (ممتاز، جيد جداً، إلخ)، مما يعطي لمحة سريعة عن مستوى الأداء العام.';
        const gradeCounts = { 'ممتاز': 0, 'جيد جداً': 0, 'جيد': 0, 'مقبول': 0, 'ضعيف': 0, 'الغياب': 0 };

        const subjectFilterValues = getSelectedFilterValues('subjectFilter');
        const selectedSubjectKeyForChart = (subjectFilterValues.length === 1 && subjectFilterValues[0] !== 'الكل')
            ? subjectKeys.find(key => subjectLabels[key] === subjectFilterValues[0])
            : null;

        students.forEach(student => {
            const scoreToCategorize = selectedSubjectKeyForChart ? getScoreAsPercentage(student.scores[selectedSubjectKeyForChart] ?? 0) : student.overall;

            gradeCounts[getGradeCategory(scoreToCategorize)]++;
        });

        total = Object.values(gradeCounts).reduce((a, b) => a + b, 0);

        chartData = {
            labels: Object.keys(gradeCounts),
            datasets: [{ data: Object.values(gradeCounts), backgroundColor: chartColors.grades }]
        };
        chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    bodyFont: { family: "'Cairo', sans-serif" },
                    titleFont: { family: "'Cairo', sans-serif" },
                    callbacks: {
                        label: (context) => {
                            const totalInCallback = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const value = context.parsed;
                            const percent = totalInCallback > 0 ? (value / totalInCallback) * 100 : 0;
                            return `${value} طالب (${formatPercentage(percent)})`;
                        }
                    }
                },
                datalabels: { display: false },
                legend: {
                    position: 'right',
                    labels: {
                        font: { family: "'Cairo', sans-serif" },
                        generateLabels: (chart) => {
                            const data = chart.data.datasets[0].data;
                            const totalInCallback = data.reduce((a, b) => a + b, 0);
                            return chart.data.labels.map((label, i) => {
                                const value = data[i];
                                const percentage = totalInCallback > 0 ? (value / totalInCallback) * 100 : 0;
                                return {
                                    text: `${label}: ${value} طلاب (${formatPercentage(percentage)})`,
                                    fillStyle: chart.data.datasets[0].backgroundColor[i],
                                    hidden: isNaN(value) || value === 0,
                                    index: i
                                };
                            });
                        }
                    }
                }
            }
        };
    }

    gradeDistributionChart = updateChart(gradeDistributionChart, ctx, 'doughnut', chartData, chartOptions, [window.ChartDataLabels]);

    if (total === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "16px 'Cairo', sans-serif";
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        const message = students.length === 1 ? 'لا توجد مواد لعرضها' : 'لا يوجد طلاب لعرض توزيع التقديرات';
        ctx.fillText(message, ctx.canvas.width / 2, ctx.canvas.height / 2);
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
                        const percent = totalInCallback > 0 ? (value / totalInCallback) * 100 : 0;
                        return `${value} طالب (${formatPercentage(percent)})`;
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
                    generateLabels: (chart) => { // Corrected generateLabels
                        const data = chart.data.datasets[0].data;
                        const totalInCallback = data.reduce((a, b) => a + b, 0);
                        return chart.data.labels.map((label, i) => {
                            const value = data[i];
                            const percentage = totalInCallback > 0 ? (value / totalInCallback) * 100 : 0;
                            return {
                                text: `${label}: ${value} طالب (${formatPercentage(percentage)})`,
                                fillStyle: chart.data.datasets[0].backgroundColor[i],
                                strokeStyle: chart.data.datasets[0].backgroundColor[i],
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

    const calculatedGradeAverages = Object.keys(gradeAverages).map(grade => ({
        grade: grade,
        average: (gradeAverages[grade] / gradeCounts[grade])
    }));

    // Sort grades by average score in descending order
    calculatedGradeAverages.sort((a, b) => b.average - a.average);

    const labels = calculatedGradeAverages.map(item => item.grade);
    const data = calculatedGradeAverages.map(item => item.average);
    const total = data.reduce((a, b) => a + b, 0); // Define total here

    averageGradeByClassChart = updateChart(averageGradeByClassChart, ctx, 'bar', {
        labels: labels,
        datasets: [{
            label: 'متوسط الدرجة',
            data: data,
            backgroundColor: labels.map(label => getConsistentColor(label)),
            borderColor: labels.map(label => getConsistentColor(label)),
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
                formatter: (value) => formatPercentage(value)
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

function updateOverallPerformanceComparisonChart(students, timeFilterValues) {
    const ctx = document.getElementById('overallPerformanceComparisonChart').getContext('2d');

    const performanceByTime = {};
    let actualTimeLabelsToProcess = [];

    if (timeFilterValues.includes('الكل')) {
        // Get all distinct time values from the filtered students
        actualTimeLabelsToProcess = [...new Set(students.map(s => s.time).filter(Boolean))];
    } else {
        actualTimeLabelsToProcess = timeFilterValues;
    }

    actualTimeLabelsToProcess.forEach(time => {
        const studentsInTime = students.filter(s => s.time === time);
        if (studentsInTime.length > 0) {
            const avgOverall = studentsInTime.reduce((acc, s) => acc + s.overall, 0) / studentsInTime.length;
            performanceByTime[time] = avgOverall;
        }
    });

    // Do not sort time labels, keep them in their original order
    const data = actualTimeLabelsToProcess.map(time => performanceByTime[time] || 0); // Use 0 if no data for a time period

    // Calculate ranks
    const rankedData = data.map((value, index) => ({ value, originalIndex: index }));
    rankedData.sort((a, b) => b.value - a.value); // Sort descending for ranking

    const ranks = new Array(data.length);
    let currentRank = 1;
    for (let i = 0; i < rankedData.length; i++) {
        if (i > 0 && rankedData[i].value < rankedData[i - 1].value) {
            currentRank = i + 1;
        }
        ranks[rankedData[i].originalIndex] = currentRank;
    }

    // Calculate trend line data (simple linear regression) - Keep existing trend line logic
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += data[i];
        sumXY += (i * data[i]);
        sumX2 += (i * i);
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const trendData = data.map((_, i) => intercept + slope * i);

    overallPerformanceComparisonChart = updateChart(overallPerformanceComparisonChart, ctx, 'bar', {
        labels: actualTimeLabelsToProcess,
        datasets: [
            {
                label: 'متوسط الأداء', // This label will be overridden by generateLabels
                data: data,
                backgroundColor: actualTimeLabelsToProcess.map((label, index) => generateColors(actualTimeLabelsToProcess.length)[index]),
                borderColor: actualTimeLabelsToProcess.map((label, index) => generateColors(actualTimeLabelsToProcess.length)[index]),
                borderWidth: 1,
                barPercentage: 0.8,
                categoryPercentage: 0.8,
            }
        ]
    }, {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, max: 100, grid: { color: '#e2e8f0' }, ticks: { font: { family: "'Cairo', sans-serif" } } },
            x: { grid: { color: '#f1f5f9' }, ticks: { font: { family: "'Cairo', sans-serif" }, color: '#0f766e' } }
        },
        plugins: {
            legend: {
                display: true, // Show legend
                position: 'top', // Position legend at the top
                labels: {
                    font: { family: "'Cairo', sans-serif" }, // Apply Arabic font
                    generateLabels: (chart) => {
                        const labels = chart.data.labels; // These are the time periods
                        const backgroundColors = chart.data.datasets[0].backgroundColor;
                        return labels.map((label, i) => ({
                            text: label, // Display the time period as the legend text
                            fillStyle: backgroundColors[i],
                            strokeStyle: backgroundColors[i],
                            lineWidth: 1,
                            hidden: false, // Always show
                            index: i
                        }));
                    }
                }
            },
            tooltip: { bodyFont: { family: "'Cairo', sans-serif" }, titleFont: { family: "'Cairo', sans-serif" }, callbacks: { label: (context) => `${context.dataset.label}: ${formatPercentage(context.parsed.y)}` } },
            datalabels: {
                labels: {
                    rank: {
                        display: true,
                        anchor: 'center', // Position in the center of the bar
                        align: 'center',
                        color: '#fff', // White color for better contrast on bars
                        font: { family: "'Cairo', sans-serif", weight: 'bold', size: 24 }, // Larger font size for prominence
                        formatter: (value, context) => ranks[context.dataIndex]
                    },
                    percentage: {
                        display: true,
                        anchor: 'end', // Position at the top of the bar
                        align: 'top',
                        offset: 4, // Small offset from the top of the bar
                        color: '#000', // Black color for visibility
                        font: { family: "'Cairo', sans-serif", weight: 'bold', size: 13 },
                        formatter: (value) => formatPercentage(value)
                    }
                }
            }
        }
    }, [window.ChartDataLabels]);

    if (data.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "16px 'Cairo', sans-serif";
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText('لا توجد بيانات لعرض مقارنة الأداء العام', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
}

function updateSubjectPerformancePerMonthChart(students, timeFilterValues) {
    const ctx = document.getElementById('subjectPerformancePerMonthChart').getContext('2d');

    const dataBySubjectAndTime = {};
    let actualTimeLabelsToProcess = [];
    const subjectFilterValues = getSelectedFilterValues('subjectFilter');
    const subjectKeyMap = Object.fromEntries(Object.entries(subjectLabels).map(([key, label]) => [label, key]));

    if (timeFilterValues.includes('الكل')) {
        actualTimeLabelsToProcess = [...new Set(students.map(s => s.time).filter(Boolean))];
    } else {
        actualTimeLabelsToProcess = timeFilterValues;
    }

    let subjectsToDisplay = [];
    if (subjectFilterValues.includes('الكل')) {
        subjectsToDisplay = subjectKeys.filter(key => key !== 'behavior');
    } else {
        subjectsToDisplay = subjectFilterValues.map(label => subjectKeyMap[label]).filter(Boolean);
    }

    // Populate dataBySubjectAndTime only for subjects to display
    actualTimeLabelsToProcess.forEach(time => {
        const studentsInTime = students.filter(s => s.time === time);
        const subjectAvgs = calculateSubjectAverages(studentsInTime);
        subjectsToDisplay.forEach(subjectKey => {
            if (subjectKey !== 'behavior') {
                if (!dataBySubjectAndTime[subjectKey]) {
                    dataBySubjectAndTime[subjectKey] = {};
                }
                dataBySubjectAndTime[subjectKey][time] = subjectAvgs[subjectKey] || 0; // Ensure 0 if no data
            }
        });
    });

    // Calculate average performance for each subject across all selected time periods
    const subjectOverallAverages = {};
    subjectsToDisplay.forEach(subjectKey => {
        let totalPerformance = 0;
        let count = 0;
        actualTimeLabelsToProcess.forEach(time => {
            if (dataBySubjectAndTime[subjectKey] && dataBySubjectAndTime[subjectKey][time] !== undefined) {
                totalPerformance += dataBySubjectAndTime[subjectKey][time];
                count++;
            }
        });
        subjectOverallAverages[subjectKey] = count > 0 ? totalPerformance / count : 0;
    });

    // Sort subjects by their overall average performance in descending order
    const sortedSubjects = subjectsToDisplay.sort((a, b) => subjectOverallAverages[b] - subjectOverallAverages[a]);
    const sortedTimeLabels = actualTimeLabelsToProcess.sort(); // Use sorted time labels for consistent color mapping

    const datasets = sortedTimeLabels.map((time, index) => {
        const color = generateColors(sortedTimeLabels.length)[index]; // Unique color for each time period
        return {
            label: time,
            data: sortedSubjects.map(subjectKey => dataBySubjectAndTime[subjectKey]?.[time] || 0),
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            barPercentage: 0.8,
            categoryPercentage: 0.8,
        };
    });

    subjectPerformancePerMonthChart = updateChart(subjectPerformancePerMonthChart, ctx, 'bar', {
        labels: sortedSubjects.map(key => subjectLabels[key] || key), // Subjects on X-axis
        datasets: datasets
    }, {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, max: 100, grid: { color: '#e2e8f0' }, ticks: { font: { family: "'Cairo', sans-serif" } } },
            x: { grid: { color: '#f1f5f9' }, ticks: { font: { family: "'Cairo', sans-serif" }, color: '#0f766e' } }
        },
        plugins: {
            legend: { position: 'top', labels: { font: { family: "'Cairo', sans-serif" } } },
            tooltip: { bodyFont: { family: "'Cairo', sans-serif" }, titleFont: { family: "'Cairo', sans-serif" }, callbacks: { label: (context) => `${context.dataset.label}: ${formatPercentage(context.parsed.y)}` } },
            datalabels: {
                display: true, // Enable datalabels
                anchor: 'end',
                align: 'center', // Align to the center of the anchor point (top of the bar)
                color: '#000',
                font: { family: "'Cairo', sans-serif", weight: 'bold', size: 11 },
                formatter: (value) => formatPercentage(value)
            }
        }
    }, [window.ChartDataLabels]);

    if (sortedSubjects.length === 0 || sortedTimeLabels.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "16px 'Cairo', sans-serif";
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText('لا توجد بيانات لعرض أداء المواد لكل فترة', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
}

function updateClassPerformancePerMonthChart(students, timeFilterValues) {
    const ctx = document.getElementById('classPerformancePerMonthChart').getContext('2d');

    const dataByTimeAndClass = {};
    const allClasses = new Set();
    let actualTimeLabelsToProcess = [];

    if (timeFilterValues.includes('الكل')) {
        actualTimeLabelsToProcess = [...new Set(students.map(s => s.time).filter(Boolean))];
    } else {
        actualTimeLabelsToProcess = timeFilterValues;
    }

    actualTimeLabelsToProcess.forEach(time => {
        dataByTimeAndClass[time] = {};
        const studentsInTime = students.filter(s => s.time === time);
        const classAverages = {};
        const classCounts = {};

        studentsInTime.forEach(student => {
            classAverages[student.grade] = (classAverages[student.grade] || 0) + student.overall;
            classCounts[student.grade] = (classCounts[student.grade] || 0) + 1;
            allClasses.add(student.grade);
        });

        for (const grade in classAverages) {
            dataByTimeAndClass[time][grade] = classAverages[grade] / classCounts[grade];
        }
    });

    // Calculate average performance for each class across all selected time periods
    const classOverallAverages = {};
    Array.from(allClasses).forEach(grade => {
        let totalPerformance = 0;
        let count = 0;
        actualTimeLabelsToProcess.forEach(time => {
            if (dataByTimeAndClass[time] && dataByTimeAndClass[time][grade] !== undefined) {
                totalPerformance += dataByTimeAndClass[time][grade];
                count++;
            }
        });
        classOverallAverages[grade] = count > 0 ? totalPerformance / count : 0;
    });

    // Sort classes by their overall average performance in descending order
    const sortedClasses = Array.from(allClasses).sort((a, b) => classOverallAverages[b] - classOverallAverages[a]);
    const sortedTimeLabels = actualTimeLabelsToProcess.sort();

    const datasets = sortedTimeLabels.map((time, index) => {
        const color = generateColors(sortedTimeLabels.length)[index]; // Generate unique colors for time periods
        return {
            label: time,
            data: sortedClasses.map(grade => dataByTimeAndClass[time][grade] || 0),
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            barPercentage: 0.8,
            categoryPercentage: 0.8,
        };
    });

    classPerformancePerMonthChart = updateChart(classPerformancePerMonthChart, ctx, 'bar', {
        labels: sortedClasses,
        datasets: datasets
    }, {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, max: 100, grid: { color: '#e2e8f0' }, ticks: { font: { family: "'Cairo', sans-serif" } } },
            x: { grid: { color: '#f1f5f9' }, ticks: { font: { family: "'Cairo', sans-serif" }, color: '#0f766e' } }
        },
        plugins: {
            legend: { position: 'top', labels: { font: { family: "'Cairo', sans-serif" } } },
            tooltip: { bodyFont: { family: "'Cairo', sans-serif" }, titleFont: { family: "'Cairo', sans-serif" }, callbacks: { label: (context) => `${context.dataset.label}: ${formatPercentage(context.parsed.y)}` } },
            datalabels: {
                display: true, // Enable datalabels
                anchor: 'end', // Position at the end of the bar
                align: 'top', // Align to the top of the bar
                color: '#000', // Black color for visibility
                font: { family: "'Cairo', sans-serif", weight: 'bold', size: 11 },
                formatter: (value) => formatPercentage(value) // Format as percentage
            }
        }
    }, [window.ChartDataLabels]);

    if (sortedTimeLabels.length === 0 || sortedClasses.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "16px 'Cairo', sans-serif";
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText('لا توجد بيانات لعرض أداء الصفوف لكل فترة', ctx.canvas.width / 2, ctx.canvas.height / 2);
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
        // When subjects are filtered, show exactly those subjects.
        const selectedSubjectKeys = subjectFilterValues.map(label => subjectKeyMap[label]).filter(Boolean);
        columnsToShow = selectedSubjectKeys;
    }

    const hidePercentageColumn = subjectFilterValues.length > 0 && !subjectFilterValues.includes('الكل');
    
    updateTableHeader(columnsToShow, hidePercentageColumn, shouldShowTimeColumn);

    if (students.length === 0) {
        // Adjust column count based on whether 'نوع التحليل' is shown
        let columnCount = 4 + columnsToShow.length + 2; // Base + subjects + total + grade
        if (!hidePercentageColumn) columnCount++; // Add percentage if shown
        if (shouldShowTimeColumn) columnCount++; // Add time if shown

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
        
        const createCell = (content, classes = '') => {
            const cell = document.createElement('td');
            cell.className = classes;
            cell.textContent = content;
            return cell;
        };

        row.appendChild(createCell(idx + 1, 'px-2 py-2 font-bold'));
        row.appendChild(createCell(student.name, 'px-3 py-2 font-medium text-slate-900 whitespace-nowrap'));
        row.appendChild(createCell(student.grade, 'px-2 py-2'));
        row.appendChild(createCell(student.section, 'px-2 py-2'));

        columnsToShow.forEach(key => {
            const score = student.scores[key];
            row.appendChild(createCell(score != null ? Math.round(score) : '-', 'px-1 py-2'));
        });

        row.appendChild(createCell(student.totalScore != null ? Math.round(student.totalScore) : '-', 'px-2 py-2 font-bold text-blue-600'));
        
        if (!hidePercentageColumn) {
            // Use a specific cell for percentage to handle the format correctly
            const percentageCell = document.createElement('td');
            percentageCell.className = 'px-2 py-2 font-bold';
            percentageCell.textContent = formatPercentage(student.percent);
            row.appendChild(percentageCell);
        }
        
        // Conditionally add the 'نوع التحليل' column
        if (shouldShowTimeColumn) {
            row.appendChild(createCell(student.time || '-', 'px-2 py-2'));
        }
        
        row.appendChild(createCell(student.category, `px-2 py-2 font-bold ${getCategoryColorClass(student.category)}`));

        fragment.appendChild(row);
    });
    tableBody.appendChild(fragment);
}

function updateTableHeader(columnsToShow, hidePercentageColumn, showTimeColumn) {
    const thead = document.querySelector('table thead');
    if (!thead) return;

    const baseHeaders = ['الترتيب', 'اسم الطالب', 'الصف', 'القسم'];
    const dynamicSubjectHeaders = columnsToShow.map(key => subjectLabels[key]);
    
    let endHeaders = ['المجموع', 'التقدير'];
    if (!hidePercentageColumn) {
        endHeaders.splice(1, 0, 'النسبة'); // Insert 'النسبة' after 'المجموع'
    }
    if (showTimeColumn) {
        endHeaders.splice(endHeaders.length - 1, 0, 'نوع التحليل'); // Insert 'نوع التحليل' before 'التقدير'
    }
    
    let allHeaders = [...baseHeaders, ...dynamicSubjectHeaders, ...endHeaders];

    thead.innerHTML = `
        <tr>${allHeaders.map(header => `<th scope="col" class="px-2 py-3 whitespace-nowrap">${header}</th>`).join('')}</tr>
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

// Function to export chart data to Excel
function exportChartDataAsExcel(chartInstance, filename) {
    if (!chartInstance) {
        alert('لا توجد بيانات للمخطط لتصديرها.');
        return;
    }

    const data = chartInstance.data;
    const sheetData = [];

    // Determine the main label for the first column (e.g., 'الفترة', 'المادة', 'التقدير', 'الصف')
    let mainLabel = 'الفئة'; // Default label
    if (chartInstance.canvas.id === 'subjectAverageChart') mainLabel = 'المادة';
    else if (chartInstance.canvas.id === 'gradeDistributionChart') mainLabel = 'التقدير';
    else if (chartInstance.canvas.id === 'gradeStudentDistributionChart') mainLabel = 'الصف';
    else if (chartInstance.canvas.id === 'averageGradeByClassChart') mainLabel = 'الصف';
    else if (chartInstance.canvas.id === 'overallPerformanceComparisonChart') mainLabel = 'الفترة';
    else if (chartInstance.canvas.id === 'subjectPerformancePerMonthChart') mainLabel = 'المادة';
    else if (chartInstance.canvas.id === 'classPerformancePerMonthChart') mainLabel = 'الصف';


    // Create header row: [Main Label, Dataset1 Label, Dataset2 Label, ...]
    const headerRow = [mainLabel];
    data.datasets.forEach(dataset => {
        headerRow.push(dataset.label);
    });
    sheetData.push(headerRow);

    // Populate data rows
    data.labels.forEach((label, labelIndex) => {
        const row = [label];
        data.datasets.forEach(dataset => {
            row.push(dataset.data[labelIndex]);
        });
        sheetData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "بيانات المخطط");
    XLSX.writeFile(wb, filename);
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

let gradeFilterDropdown, sectionFilterDropdown, divisionFilterDropdown, categoryFilterDropdown, subjectFilterDropdown, timeFilterDropdown;

function setupEventListeners() {
    const levelFilterSelect = document.getElementById('levelFilter');
    const percentageModal = document.getElementById('percentageModal');
    const percentageModalTitle = document.getElementById('percentageModalTitle');
    const percentageInput = document.getElementById('percentageInput');
    const percentageError = document.getElementById('percentageError');
    const applyPercentageBtn = document.getElementById('applyPercentageBtn');
    const cancelPercentageBtn = document.getElementById('cancelPercentageBtn');

    levelFilterSelect.addEventListener('change', (event) => {
        const selectedValue = event.target.value;
        if (selectedValue === 'greaterThan' || selectedValue === 'lessThan') {
            percentageModalTitle.textContent = selectedValue === 'greaterThan' ? 'تصفية أعلى من' : 'تصفية أدنى من';
            percentageInput.value = ''; // Clear previous input
            percentageError.textContent = ''; // Clear previous error
            percentageModal.classList.remove('hidden');
        } else {
            currentPercentageFilter = null; // Reset filter if not 'greaterThan' or 'lessThan'
            updateDashboard();
        }
    });

    applyPercentageBtn.addEventListener('click', () => {
        const value = parseInt(percentageInput.value, 10);
        if (value >= 1 && value <= 100) {
            currentPercentageFilter = value;
            percentageModal.classList.add('hidden');
            updateDashboard();
        } else {
            percentageError.textContent = 'الرجاء إدخال نسبة بين 1 و 100.';
        }
    });

    cancelPercentageBtn.addEventListener('click', () => {
        currentPercentageFilter = null;
        levelFilterSelect.value = 'الكل'; // Reset the dropdown selection
        percentageModal.classList.add('hidden');
        updateDashboard();
    });

    document.getElementById('analyzeBtn').addEventListener('click', runAnalysis);
    document.getElementById('resetAppBtn').addEventListener('click', () => {
        // إظهار رسالة تأكيد قبل إعادة تحميل الصفحة
        if (confirm('سيتم إلغاء جميع بياناتك الحالية، لفتح صفحة جديدة.. هل انت متأكد من إعادة الضبط؟')) {
            location.reload();
        }
    });
    document.getElementById('studentSearchInput').addEventListener('input', updateDashboard);

    gradeFilterDropdown = initializeMultiSelectDropdown('gradeFilter');
    sectionFilterDropdown = initializeMultiSelectDropdown('sectionFilter');
    divisionFilterDropdown = initializeMultiSelectDropdown('divisionFilter'); // NEW
    categoryFilterDropdown = initializeMultiSelectDropdown('categoryFilter');
    subjectFilterDropdown = initializeMultiSelectDropdown('subjectFilter');
    timeFilterDropdown = initializeMultiSelectDropdown('timeFilter');

    const maxScoreInput = document.getElementById('maxScoreInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const maxScoreError = document.getElementById('maxScoreError');

    maxScoreInput.addEventListener('input', () => {
        const value = parseInt(maxScoreInput.value, 10);
        if (value >= 10 && value <= 100) {
            analyzeBtn.disabled = false;
            maxScoreError.textContent = '';
        } else {
            analyzeBtn.disabled = true;
            maxScoreError.textContent = 'الدرجة يجب أن تكون بين 10 و 100.';
        }
    });

    document.addEventListener('click', (event) => {
        ['gradeFilter', 'sectionFilter', 'divisionFilter', 'categoryFilter', 'subjectFilter', 'timeFilter'].forEach(id => { // Added divisionFilter
            const dropdown = document.getElementById(`${id}Dropdown`);
            const toggleButton = document.getElementById(`${id}Toggle`);
            if (dropdown && toggleButton && !dropdown.contains(event.target) && !toggleButton.contains(event.target)) {
                dropdown.classList.add('hidden');
            }
        });
    });

    document.getElementById('downloadExcelBtn').addEventListener('click', exportTableAsExcel);
    document.getElementById('exportSubjectChartBtn').addEventListener('click', () => exportChart('subjectAverageChart', 'subject_average_chart.png'));
    document.getElementById('exportSubjectChartDataBtn').addEventListener('click', () => exportChartDataAsExcel(subjectAverageChart, 'subject_average_chart_data.xlsx'));
    document.getElementById('exportGradeChartBtn').addEventListener('click', () => exportChart('gradeDistributionChart', 'grade_distribution_chart.png'));
    document.getElementById('exportGradeChartDataBtn').addEventListener('click', () => exportChartDataAsExcel(gradeDistributionChart, 'grade_distribution_chart_data.xlsx'));
    document.getElementById('exportGradeStudentDistributionChartBtn').addEventListener('click', () => exportChart('gradeStudentDistributionChart', 'grade_student_distribution_chart.png'));
    document.getElementById('exportGradeStudentDistributionChartDataBtn').addEventListener('click', () => exportChartDataAsExcel(gradeStudentDistributionChart, 'grade_student_distribution_chart_data.xlsx'));
    document.getElementById('exportAverageGradeByClassChartBtn').addEventListener('click', () => exportChart('averageGradeByClassChart', 'average_grade_by_class_chart.png'));
    document.getElementById('exportAverageGradeByClassChartDataBtn').addEventListener('click', () => exportChartDataAsExcel(averageGradeByClassChart, 'average_grade_by_class_chart_data.xlsx'));
    document.getElementById('exportOverallPerformanceComparisonChartBtn').addEventListener('click', () => exportChart('overallPerformanceComparisonChart', 'overall_performance_comparison_chart.png'));
    document.getElementById('exportOverallPerformanceComparisonChartDataBtn').addEventListener('click', () => exportChartDataAsExcel(overallPerformanceComparisonChart, 'overall_performance_comparison_chart_data.xlsx'));
    document.getElementById('exportSubjectPerformancePerMonthChartBtn').addEventListener('click', () => exportChart('subjectPerformancePerMonthChart', 'subject_performance_per_month_chart.png'));
    document.getElementById('exportSubjectPerformancePerMonthChartDataBtn').addEventListener('click', () => exportChartDataAsExcel(subjectPerformancePerMonthChart, 'subject_performance_per_month_chart_data.xlsx'));
    document.getElementById('exportClassPerformancePerMonthChartBtn').addEventListener('click', () => exportChart('classPerformancePerMonthChart', 'class_performance_per_month_chart.png'));
    document.getElementById('exportClassPerformancePerMonthChartDataBtn').addEventListener('click', () => exportChartDataAsExcel(classPerformancePerMonthChart, 'class_performance_per_month_chart_data.xlsx'));

    const csvUpload = document.getElementById('csvUpload');
    const csvTooltip = document.getElementById('csvTooltip');
    ['focus', 'mouseover'].forEach(event => csvUpload.addEventListener(event, () => csvTooltip.classList.add('tooltip-visible')));
    ['blur', 'mouseout'].forEach(event => csvUpload.addEventListener(event, () => csvTooltip.classList.remove('tooltip-visible')));
    csvUpload.addEventListener('change', handleFileUpload);

    // Report Modal Listeners
    document.getElementById('exportReportBtn').addEventListener('click', () => {
        document.getElementById('reportModal').classList.remove('hidden');
    });
    document.getElementById('cancelReportBtn').addEventListener('click', () => {
        document.getElementById('reportModal').classList.add('hidden');
    });
    document.getElementById('generateReportBtn').addEventListener('click', generatePdfReport);
    document.getElementById('reportSectionAll').addEventListener('change', (e) => {
        document.querySelectorAll('.report-section').forEach(checkbox => {
            checkbox.checked = e.target.checked;
        });
    });


    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
}

function resetFilters() {
    document.getElementById('levelFilter').value = 'الكل';
    document.getElementById('studentSearchInput').value = '';

    const multiSelectFilterInstances = [gradeFilterDropdown, sectionFilterDropdown, divisionFilterDropdown, categoryFilterDropdown, subjectFilterDropdown, timeFilterDropdown];
    multiSelectFilterInstances.forEach(instance => {
        instance.reset();
    });
    updateDashboard();
}

function runAnalysis() {
    const maxScoreInput = document.getElementById('maxScoreInput');
    globalMaxScore = parseInt(maxScoreInput.value, 10);

    if (!globalMaxScore || globalMaxScore < 10 || globalMaxScore > 100) {
        alert('الرجاء إدخال درجة نهائية صالحة بين 10 و 100.');
        return;
    }

    // Show loading overlay
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) {
        loadingMessage.textContent = 'يرجى الانتظار... جاري تحليل البيانات';
    }
    document.getElementById('loadingOverlay').classList.remove('hidden');

    // Use setTimeout to allow the UI to update and show the loader before heavy processing
    try {
        // Recalculate overall percentage for all students based on the new max score
        allStudentsData.forEach(student => {
            const subjectPercentages = subjectKeys.map(key => getScoreAsPercentage(student.scores[key] ?? 0));
            const validPercentages = subjectPercentages.filter(p => p > 0);
            const averagePercentage = validPercentages.length > 0
                ? validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length
                : 0;
            student.overall = averagePercentage;
            student.percent = averagePercentage; // Store the calculated percentage for table display
            student.category = getGradeCategory(averagePercentage);
        });

        analysisHasRun = true; // تم تشغيل التحليل بنجاح
        document.getElementById('resetAppBtn').classList.remove('hidden'); // إظهار زر إعادة الضبط

        document.getElementById('filtersSection').classList.remove('hidden');
        document.getElementById('dashboardContent').classList.remove('hidden');
        updateFilterOptions();
        // Pass a callback to hide the loader only after the dashboard has finished updating.
        updateDashboard(() => document.getElementById('loadingOverlay').classList.add('hidden'));
    } catch (error) {
        console.error("An error occurred during analysis:", error);
        alert("حدث خطأ أثناء تحليل البيانات. يرجى مراجعة وحدة التحكم للمزيد من التفاصيل.");
        // Hide loading overlay in case of an error
        document.getElementById('loadingOverlay').classList.add('hidden');
    }
}

const exportChart = (chartId, filename) => {
    const link = Object.assign(document.createElement('a'), {
        href: document.getElementById(chartId).toDataURL('image/png'),
        download: filename
    });
    link.click();
};

const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const statusMsg = document.getElementById('csvStatusMsg');
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    // Re-enable CSV support
    const isCsv = fileName.endsWith('.csv');

    if (!isCsv && !isExcel) {
        displayStatusMessage(statusMsg, 'الملف يجب أن يكون بصيغة CSV أو Excel.', 'rose');
        return;
    }

    if (isCsv) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                processParsedData(results.data, results.meta.fields);
            },
            error: () => displayStatusMessage(statusMsg, 'تعذر قراءة ملف CSV. تأكد من الصيغة.', 'rose')
        });
    } else if (isExcel) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    displayStatusMessage(statusMsg, 'ملف Excel فارغ أو لا يمكن قراءته.', 'rose');
                    return;
                }
                const headers = Object.keys(jsonData[0]);
                processParsedData(jsonData, headers);
            } catch (err) {
                console.error("Error processing Excel file:", err);
                displayStatusMessage(statusMsg, 'حدث خطأ أثناء معالجة ملف Excel.', 'rose');
            }
        };
        reader.onerror = () => {
            displayStatusMessage(statusMsg, 'تعذر قراءة ملف Excel.', 'rose');
        };
        reader.readAsArrayBuffer(file);
    }
};

function processParsedData(data, headers) {
    const statusMsg = document.getElementById('csvStatusMsg');
    try {
        const fileHeaders = (headers || []).map(h => String(h).trim());
        const requiredHeaders = ['اسم الطالب', 'الصف'];
        const missingHeaders = requiredHeaders.filter(h => !fileHeaders.includes(h));
        if (missingHeaders.length > 0) {
            displayStatusMessage(statusMsg, `الملف ينقصه الأعمدة المطلوبة: ${missingHeaders.join(', ')}`, 'rose');
            return;
        }

        const fixedHeaders = ['اسم الطالب', 'الصف', 'القسم', 'الشعبة', 'سلوك', 'النسبة', 'نوع التحليل']; // Added 'الشعبة'
        
        subjectLabels = {};
        subjectKeys = [];
        fileHeaders.forEach(header => {
            if (!fixedHeaders.includes(header)) {
                const cleanHeader = header;
                const key = String(cleanHeader).replace(/\s/g, '').toLowerCase();
                subjectLabels[key] = cleanHeader;
                subjectKeys.push(key);
            }
        });

        // Normalize row keys by trimming them, to match the trimmed headers
        const normalizedData = data.map(row => {
            const newRow = {};
            for (const key in row) {
                newRow[String(key).trim()] = row[key];
            }
            return newRow;
        });

        allStudentsData = normalizedData.map(row => {
            const scores = {};
            let totalScore = 0;
            subjectKeys.forEach(key => {
                // Ensure the key exists in the row, otherwise default to 0.
                // subjectLabels[key] is the trimmed header name, which matches the keys in the `row` object.
                const score = Number(row[subjectLabels[key]]) || 0;
                scores[key] = score;
                totalScore += score;
            });
            // Access other fields safely
            scores['behavior'] = Number(row['سلوك']) || 0; // Behavior score remains raw
            // The 'percent' and 'overall' from the file are now ignored. They will be calculated on analysis.
            return { name: row['اسم الطالب'], grade: row['الصف'], section: row['القسم'], division: row['الشعبة'] || null, scores: scores, percent: 0, totalScore: totalScore, overall: 0, time: row['نوع التحليل'] || null, category: 'N/A' }; // Added division
        });

        // Determine if 'نوع التحليل' column should be shown
        shouldShowTimeColumn = allStudentsData.some(student => student.time !== null && student.time !== undefined && student.time !== '');

        dynamicSubjectColors = generateColors(subjectKeys.length);
        
        // Enable the next step
        document.getElementById('maxScoreInput').disabled = false;
        displayStatusMessage(statusMsg, 'تم رفع الملف. أدخل الدرجة النهائية ثم اضغط "تحليل النتائج".', 'teal', 8000);

    } catch (err) {
        console.error("Error processing data:", err);
        displayStatusMessage(statusMsg, 'حدث خطأ أثناء معالجة البيانات.', 'rose');
    }
}

async function generatePdfReport() {
    const { jsPDF } = window.jspdf;
    const schoolName = document.getElementById('schoolNameInput').value || 'المدرسة';
    const teacherName = document.getElementById('teacherNameInput').value || 'المستخدم';
    const logoFile = document.getElementById('schoolLogoInput').files[0];
    const includeSummary = document.getElementById('reportSectionSummary').checked;
    const includeStats = document.getElementById('reportSectionStats').checked;
    const includeCharts = document.getElementById('reportSectionCharts').checked;
    const includeTable = document.getElementById('reportSectionTable').checked;

    if (!includeSummary && !includeStats && !includeCharts && !includeTable) {
        alert('يرجى اختيار محور واحد على الأقل للتقرير.');
        return;
    }

    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) {
        loadingMessage.textContent = 'يرجى الانتظار... يتم إنشاء التقرير';
    }
    document.getElementById('loadingOverlay').classList.remove('hidden');
    document.getElementById('reportModal').classList.add('hidden');

    try {
        // --- PDF Setup ---
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let yPos = margin;

        // --- Styling ---
        const primaryColor = '#0d9488'; // teal-600
        const headerColor = '#1e293b';  // slate-800
        const textColor = '#334155';    // slate-700
        const valueColor = '#2563eb';   // blue-600 for stat values

        // --- Read Logo ---
        let logoDataUrl = null;
        if (logoFile) {
            logoDataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(logoFile);
            });
        }

        // Add Amiri font for Arabic support
        if (!amiriFont) {
            const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf';
            const response = await fetch(fontUrl);
            const fontBlob = await response.blob();
            amiriFont = await new Promise((resolve, reject) => { //NOSONAR
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(fontBlob);
            });
        }
        if (!amiriBoldFont) {
            const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Bold.ttf';
            const response = await fetch(fontUrl);
            const fontBlob = await response.blob();
            amiriBoldFont = await new Promise((resolve, reject) => { //NOSONAR
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(fontBlob);
            });
        }
        doc.addFileToVFS('Amiri-Regular.ttf', amiriFont); // Add font to virtual file system
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal'); // Register font
        doc.addFileToVFS('Amiri-Bold.ttf', amiriBoldFont);
        doc.addFont('Amiri-Bold.ttf', 'Amiri', 'bold');
        doc.setFont('Amiri', 'normal'); // Set font for the entire document

        const checkPageBreak = (neededHeight) => {
            if (yPos + neededHeight > pageHeight - margin) {
                doc.addPage();
                yPos = margin;
                // Re-draw footer on new page if needed, or handle in footer section
            }
        };

        // --- Header ---
        const headerStartY = yPos;
        let headerMaxHeight = 0;

        // Add logo if it exists
        if (logoDataUrl) {
            const logoProperties = doc.getImageProperties(logoDataUrl);
            const logoHeight = 15; // Set a fixed height for the logo
            const logoWidth = (logoProperties.width * logoHeight) / logoProperties.height;
            doc.addImage(logoDataUrl, 'PNG', margin, headerStartY, logoWidth, logoHeight);
            headerMaxHeight = Math.max(headerMaxHeight, logoHeight);
        }

        doc.setTextColor(valueColor); // Set school name color to blue
        doc.setFontSize(18);
        doc.text(schoolName, pageWidth - margin, headerStartY + 7, { align: 'right' });
        yPos = headerStartY + headerMaxHeight + 5;

        // --- Report Title (Centered, with robust Bidi handling) ---
        doc.setTextColor(primaryColor);
        doc.setFontSize(22);
        const titlePart1 = 'تقرير تحليل النتائج بتاريخ  ';
        const titlePart2 = new Date().toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric', calendar: 'gregory' });
        const fullTitleWidth = doc.getTextWidth(titlePart1 + titlePart2);
        const titleStartX = (pageWidth - fullTitleWidth) / 2;
        doc.text(titlePart1, titleStartX + fullTitleWidth, yPos, { align: 'right' }); // Draw Arabic part from the right
        doc.text(titlePart2, titleStartX, yPos, { align: 'left' }); // Draw Date part from the left
        yPos += 8;

        // --- Filter Info (Centered) ---
        doc.setTextColor(textColor);
        doc.setFontSize(14);
        const filterText = document.getElementById('studentsTableTitle').textContent.replace('كشف الطلاب والدرجات', '').replace(' - ', ' ');
        doc.text(filterText, pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        // --- Separator Line ---
        doc.setDrawColor(primaryColor);
        doc.line(margin, yPos, pageWidth - margin, yPos); // Separator line
        yPos += 10;

        // --- Section: Executive Summary ---
        if (includeSummary) {
            checkPageBreak(40); // Check for space
            doc.setTextColor(primaryColor);
            doc.setFontSize(18);
            doc.setFont('Amiri', 'bold');
            doc.text('ملخص النتائج', pageWidth - margin, yPos, { align: 'right' });
            doc.setFont('Amiri', 'normal');
            yPos += 10;
            
            // --- Summary Content with Styling ---
            const summaryData = {
                total: document.getElementById('totalStudents').textContent,
                avg: document.getElementById('averageScore').textContent,
                success: document.getElementById('successCount').textContent,
                fail: document.getElementById('failureCount').textContent,
                topSub: document.getElementById('topSubject').textContent,
                botSub: document.getElementById('bottomSubject').textContent,
                topCls: document.getElementById('topClass').textContent,
                botCls: document.getElementById('bottomClass').textContent,
            };

            const summaryText = `يستعرض هذا التقرير تحليل نتائج لـ ${summaryData.total} طالبًا. بلغ متوسط التقدير العام ${summaryData.avg}. وقد أظهرت النتائج نجاح ${summaryData.success} طالبًا، بينما لم يتمكن ${summaryData.fail} طالبًا من تحقيق درجة النجاح. على صعيد المواد، كانت مادة "${summaryData.topSub}" هي الأعلى أداءً، في حين كانت مادة "${summaryData.botSub}" هي الأقل أداءً. أما على مستوى الصفوف، فقد حقق "${summaryData.topCls}" أعلى متوسط أداء، بينما كان "${summaryData.botCls}" هو الأدنى.`;

            const lineSpacing = 7; // Increased line spacing
            const summaryLines = doc.splitTextToSize(summaryText, pageWidth - (margin * 2));
            const summaryHeight = (summaryLines.length * lineSpacing) + 5; // Calculate height of the summary box

            // Draw background for summary
            doc.setFillColor('#f0fdfa'); // teal-50
            doc.rect(margin, yPos - 5, pageWidth - (margin * 2), summaryHeight, 'F');

            // Draw summary text with increased line spacing
            doc.setTextColor(textColor);
            doc.setFontSize(12);
            doc.text(summaryLines, pageWidth - margin, yPos, { align: 'right', lineHeightFactor: 1.5 });

            yPos += summaryHeight; // Adjust yPos after the summary box
        }

        // --- Section 1: Statistics ---
        if (includeStats) {
            if (includeSummary) {
                yPos += 10; // Add space between summary and stats only if summary is included
            }
            checkPageBreak(40);
            doc.setTextColor(primaryColor);
            doc.setFontSize(18);
            doc.setFont('Amiri', 'bold');
            doc.text('الإحصائيات العامة', pageWidth - margin, yPos, { align: 'right' });
            doc.setFont('Amiri', 'normal');
            yPos += 10;

            const renderStat = (stat, x, y) => {
                if (!stat) return;
                const fullText = `${stat.l}: ${stat.v}`;
                doc.setTextColor(textColor);
                doc.text(fullText, x, y, { align: 'right' });
            };

            // Separate the main stat to be displayed on its own line
            const mainStat = { l: 'متوسط التقدير العام', v: document.getElementById('averageScore').textContent };

            const otherStats = [
                { l: 'إجمالي الطلاب', v: document.getElementById('totalStudents').textContent },
                { l: 'عدد الناجحين', v: document.getElementById('successCount').textContent },
                { l: 'عدد الراسبين', v: document.getElementById('failureCount').textContent },
                { l: 'عدد الغياب', v: document.getElementById('absenceCount').textContent },
                { l: 'أعلى مادة أداءً', v: document.getElementById('topSubject').textContent },
                { l: 'أقل مادة أداءً', v: document.getElementById('bottomSubject').textContent },
                { l: 'أعلى صف أداءً', v: document.getElementById('topClass').textContent },
                { l: 'أدنى صف أداءً', v: document.getElementById('bottomClass').textContent },
                { l: 'أعلى طالب أداءً', v: document.getElementById('topStudentName').textContent },
                { l: 'أدنى طالب أداءً', v: document.getElementById('bottomStudentName').textContent },
               
            ];

            const stripeColor = '#f1f5f9'; // slate-100
            const rowHeight = 10;
            doc.setTextColor(textColor);
            doc.setFontSize(13); // Slightly larger font for the main stat

            // 1. Draw the main stat on its own line with a background
            doc.setFillColor(stripeColor);
            doc.rect(margin, yPos - 7, pageWidth - (margin * 2), rowHeight, 'F');
            renderStat(mainStat, pageWidth - margin, yPos);
            yPos += rowHeight;

            doc.setFontSize(12); // Reset font size for other stats

            // 2. Loop through other stats in pairs to create rows
            for (let i = 0; i < Math.ceil(otherStats.length / 2); i++) {
                // Stripe rows that are odd in the new sequence (i=1, 3, 5...)
                if (i % 2 !== 0) {
                    doc.setFillColor(stripeColor);
                    doc.rect(margin, yPos - 7, pageWidth - (margin * 2), rowHeight, 'F');
                }

                renderStat(otherStats[i * 2], pageWidth - margin, yPos);
                renderStat(otherStats[i * 2 + 1], pageWidth - margin - (pageWidth / 2.5), yPos);
                yPos += rowHeight;
            }
            yPos += 5; // Add some padding after the stats section
        }

        // --- Section 2: Charts ---
        if (includeCharts) {
            const chartIds = ['subjectAverageChart', 'gradeDistributionChart', 'gradeStudentDistributionChart', 'averageGradeByClassChart'];
            const comparativeChartIds = ['overallPerformanceComparisonChart', 'subjectPerformancePerMonthChart', 'classPerformancePerMonthChart'];
            let allChartIds = [...chartIds];

            // Check if the comparative charts section is currently visible on the dashboard
            const shouldIncludeComparativeCharts = document.getElementById('comparativeChartsSection') && !document.getElementById('comparativeChartsSection').classList.contains('hidden');

            if (shouldIncludeComparativeCharts) {
                allChartIds = [...chartIds, ...comparativeChartIds];
            }

            let isFirstChartInSection = true;

            for (const chartId of allChartIds) {
                const chartContainer = document.getElementById(chartId)?.closest('.bg-white');
                if (chartContainer) {
                    const canvas = await html2canvas(chartContainer, { scale: 2, backgroundColor: '#ffffff' });
                    const imgData = canvas.toDataURL('image/png');
                    
                    const imgWidth = pageWidth - (margin * 4); // Use more width
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    const xCentered = (pageWidth - imgWidth) / 2;

                    if (isFirstChartInSection) {
                        const titleHeight = 10;
                        // Check if title AND first chart fit on the current page.
                        checkPageBreak(titleHeight + imgHeight + 10);
                        
                        // Now draw the section title.
                        doc.setTextColor(primaryColor);
                        doc.setFontSize(18);
                        doc.setFont('Amiri', 'bold');
                        doc.text('المخططات البيانية', pageWidth - margin, yPos, { align: 'right' });
                        doc.setFont('Amiri', 'normal');
                        yPos += titleHeight;
                        isFirstChartInSection = false;
                    } else {
                        // For subsequent charts, just check if the chart itself fits.
                        checkPageBreak(imgHeight + 10);
                    }

                    doc.addImage(imgData, 'PNG', xCentered, yPos, imgWidth, imgHeight);
                    yPos += imgHeight + 10;
                }
            }
        }

        // --- Section 3: Data Table ---
        if (includeTable) {
            checkPageBreak(10 + 40); // Check for title height + table header height
            doc.setTextColor(primaryColor);
            doc.setFontSize(18);
            doc.setFont('Amiri', 'bold');
            doc.text('جدول النتائج', pageWidth - margin, yPos, { align: 'right' });
            doc.setFont('Amiri', 'normal');
            yPos += 5;

            // Get headers and body, then reverse them for RTL layout in the PDF
            const head = [Array.from(document.querySelectorAll('table thead th')).map(th => th.textContent).reverse()];
            const body = Array.from(document.querySelectorAll('table tbody tr')).map(tr => 
                Array.from(tr.querySelectorAll('td')).map(td => td.textContent).reverse()
            );

            // Define column styles for proper RTL alignment after reversing
            const columnStyles = {};
            const studentNameIndex = head[0].indexOf('اسم الطالب');
            if (studentNameIndex > -1) {
                columnStyles[studentNameIndex] = { halign: 'right' };
            }
            const categoryColumnIndex = head[0].indexOf('التقدير');

            doc.autoTable({
                startY: yPos,
                head: head,
                body: body,
                theme: 'grid',
                styles: {
                    font: 'Amiri',
                    halign: 'center', // Default alignment for all cells (good for numbers)
                    cellPadding: 2,
                    fontSize: 9,
                },
                headStyles: {
                    fillColor: primaryColor,
                    textColor: '#ffffff',
                    font: 'Amiri',
                    fontStyle: 'bold',
                    halign: 'center' // Center headers
                },
                columnStyles: columnStyles, // Apply specific right-alignment for text columns like student name
                didDrawPage: (data) => { yPos = data.cursor.y; },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === categoryColumnIndex) {
                        const category = data.cell.raw;
                        let bg, text;
                        switch (category) {
                            case 'ممتاز':
                                bg = '#dcfce7'; text = '#166534'; break; // green-100, green-800
                            case 'جيد جداً':
                                bg = '#dbeafe'; text = '#312e81'; break; // blue-100, indigo-900
                            case 'جيد':
                                bg = '#fef3c7'; text = '#854d0e'; break; // amber-100, amber-800
                            case 'مقبول':
                                bg = '#f3e8ff'; text = '#581c87'; break; // purple-100, purple-900
                            case 'ضعيف':
                                bg = '#fee2e2'; text = '#991b1b'; break; // red-100, red-800
                            case 'الغياب':
                                bg = '#e2e8f0'; text = '#1e293b'; break; // slate-200, slate-800
                            default:
                                bg = '#ffffff'; text = '#334155'; break; // white, slate-700
                        }
                        data.cell.styles.fillColor = bg;
                        data.cell.styles.textColor = text;
                    }
                }
            });
        }

        // --- Footer ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let j = 1; j <= pageCount; j++) {
            doc.setPage(j);
            doc.setTextColor(textColor);
            doc.setFontSize(10);
            
            // Add a line above the footer
            doc.setDrawColor(primaryColor);
            doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

            // --- Right-aligned prepared by text ---
            const preparedByText = `إعداد: ${teacherName}`;
            doc.text(preparedByText, pageWidth - margin, pageHeight - 10, { align: 'right' });

            // --- Centered footer text from index.html ---
            const customFooterText = 'جميع الحقوق محفوظة © م.كمال الخطابي للتواصل:00967781414133';
            doc.text(customFooterText, pageWidth / 2, pageHeight - 10, { align: 'center' });
            
            // Left-aligned page number
            doc.text(`صفحة ${j} من ${pageCount}`, margin, pageHeight - 10, { align: 'left' });
        }

        doc.save(`تقرير_تحليل_البيانات_${schoolName}.pdf`);

    } catch (error) {
        console.error("PDF Generation Error:", error);
        alert("حدث خطأ أثناء إنشاء التقرير. يرجى المحاولة مرة أخرى.");

    } finally {
        document.getElementById('loadingOverlay').classList.add('hidden');
        if (loadingMessage) {
            loadingMessage.textContent = 'يرجى الانتظار... جاري تحليل البيانات'; // Reset message
        }
    }
}

const displayStatusMessage = (element, message, type, duration = 4000) => {
    element.textContent = message;
    element.style.display = 'block';
    element.className = `mt-2 w-full text-center text-sm rounded-lg py-2 bg-${type}-100 text-${type}-700 border border-${type}-300 transition-all duration-300`;
    setTimeout(() => { element.style.display = 'none'; }, duration);
};

function updateFilterOptions() {
    sectionFilterDropdown.populateOptions([...new Set(allStudentsData.map(s => s.section).filter(Boolean))].sort());
    gradeFilterDropdown.populateOptions([...new Set(allStudentsData.map(s => s.grade).filter(Boolean))].sort());
    divisionFilterDropdown.populateOptions([...new Set(allStudentsData.map(s => s.division).filter(Boolean))].sort()); // NEW
    subjectFilterDropdown.populateOptions(Object.values(subjectLabels).filter(label => label !== 'الغياب').sort());
    categoryFilterDropdown.populateOptions(['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'ضعيف', 'الغياب']); // categoryFilter is static, re-populate to ensure order
    timeFilterDropdown.populateOptions([...new Set(allStudentsData.map(s => s.time).filter(Boolean))].sort());
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();

    // Do not run updateDashboard on load, wait for user action

    document.getElementById('helpBtn').addEventListener('click', () => {
        document.getElementById('helpModal').classList.remove('hidden');
    });

    document.getElementById('closeHelp').addEventListener('click', () => {
        document.getElementById('helpModal').classList.add('hidden');
    });

    // إضافة رسالة تأكيد قبل الخروج بعد إجراء التحليل
    window.addEventListener('beforeunload', (event) => {
        if (analysisHasRun) {
            const confirmationMessage = 'سيتم إلغاء جميع بياناتك. هل أنت متأكد من الخروج؟';
            event.preventDefault(); // مطلوب لمعظم المتصفحات
            event.returnValue = confirmationMessage; // لـ Chrome
            return confirmationMessage; // لـ Firefox ومتصفحات أخرى
        }
    });
});
