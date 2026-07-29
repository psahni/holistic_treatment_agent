from langgraph.graph import StateGraph, END
from .state import NaturopathyState
from .nodes import (
    intake_node, root_cause_node, 
    protocol_selection_node, recommendation_node, 
    guardrail_output_node
)

def should_continue_after_intake(state: NaturopathyState) -> str:
    """After intake node runs, decide what to do next.
    
    - If emergency was detected, go to guardrail immediately.
    - If step was advanced to 'root_cause' (8+ data points), proceed to analysis.
    - Otherwise, END the graph so the user can respond to the question.
    """
    if state.get('emergency_detected'):
        return 'guardrail'
    
    step = state.get('step', 'intake')
    if step == 'root_cause':
        return 'root_cause'
    
    # Step is still 'intake' — we asked a question, now wait for user response.
    # END the graph here. The user's next message will re-invoke the graph.
    return END


def build_naturopathy_graph():
    graph = StateGraph(NaturopathyState)
    
    # Add nodes
    graph.add_node('intake', intake_node)
    graph.add_node('root_cause', root_cause_node)
    graph.add_node('protocol_selection', protocol_selection_node)
    graph.add_node('recommendation', recommendation_node)
    graph.add_node('guardrail', guardrail_output_node)
    
    # Entry point: always start at intake
    graph.set_entry_point('intake')
    
    # After intake: either continue to root_cause, go to guardrail (emergency), or END (wait for user)
    graph.add_conditional_edges(
        'intake',
        should_continue_after_intake,
        {
            'root_cause': 'root_cause',
            'guardrail': 'guardrail',
            END: END
        }
    )
    
    # Analysis pipeline: root_cause → protocol_selection → recommendation → guardrail → END
    graph.add_edge('root_cause', 'protocol_selection')
    graph.add_edge('protocol_selection', 'recommendation')
    graph.add_edge('recommendation', 'guardrail')
    graph.add_edge('guardrail', END)
    
    return graph.compile()

naturopathy_graph = build_naturopathy_graph()
