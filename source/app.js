import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { processDirectory } from './analyzer.js';

const TaskItem = ({ label, isCompleted, activeDirectories, progress }) => (
  <Box flexDirection="column">
    <Text color={isCompleted ? 'green' : 'white'}>
      {isCompleted ? '✓' : '□'} {label}
      {progress && ` (${progress.current}/${progress.total})`}
    </Text>
    {activeDirectories && activeDirectories.length > 0 && (
      <Box flexDirection="column" marginLeft={1}>
        {activeDirectories.map((dir, index) => (
          <Text key={index} color="gray"> Analyzing: {dir}</Text>
        ))}
      </Box>
    )}
  </Box>
);

export default function App({ directory = process.cwd() }) {
  const [tasks, setTasks] = useState([
    { id: 'scan', label: 'Scanning directories...', completed: false },
    { id: 'analyze', label: 'Analyzing directory contents...', completed: false }
  ]);
  const [activeDirectories, setActiveDirectories] = useState(new Set());
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    const runAnalysis = async () => {
      try {
        await processDirectory(directory, ({ type, directory: dir, progress: dirProgress, action }) => {
          if (type === 'analyzing') {
            if (action === 'start') {
              setActiveDirectories(prev => {
                const next = new Set(prev);
                next.add(dir);
                return next;
              });
            } else if (action === 'end') {
              setActiveDirectories(prev => {
                const next = new Set(prev);
                next.delete(dir);
                return next;
              });
            }
            
            setProgress(dirProgress);
            setTasks(prev => prev.map(task => 
              task.id === 'scan' ? { ...task, completed: true } :
              task.id === 'analyze' ? { ...task, completed: false } :
              task
            ));
          }
        });

        setTasks(prev => prev.map(task => ({ ...task, completed: true })));
        setActiveDirectories(new Set());
        setProgress(null);
      } catch (error) {
        console.error('Error during analysis:', error);
      }
    };

    runAnalysis();
  }, [directory]);

  return (
    <Box flexDirection="column">
      <Text>Directory: {directory}</Text>
      <Box flexDirection="column" marginY={1}>
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            label={task.label}
            isCompleted={task.completed}
            activeDirectories={task.id === 'analyze' ? Array.from(activeDirectories) : []}
            progress={task.id === 'analyze' ? progress : null}
          />
        ))}
      </Box>
    </Box>
  );
}
